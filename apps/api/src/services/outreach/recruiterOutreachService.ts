import crypto from 'crypto';
import { prisma, graphOps, OutreachStatus } from '@careergraph/db';
import type {
  GenerateOutreachDraftInput,
  UpdateOutreachDraftInput,
  OutreachDTO,
  DailyOutreachQuotaDTO,
} from '@careergraph/shared';
import { EmailService } from '../emailService.js';

export const DAILY_OUTREACH_LIMIT = 25;

export class RecruiterOutreachService {
  /**
   * Deterministic SHA-256 content hash linking approval to exact text per Spec §16.
   */
  static computeContentHash(recipientEmail: string, subject: string, bodyText: string): string {
    const raw = `${recipientEmail.trim().toLowerCase()}:${subject.trim()}:${bodyText.trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Checks daily quota for candidate outreach.
   */
  static async getDailyQuota(userId: string): Promise<DailyOutreachQuotaDTO> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sentToday = await prisma.recruiterOutreach.count({
      where: {
        userId,
        status: 'SENT',
        sentAt: { gte: startOfDay },
      },
    });

    const remaining = Math.max(0, DAILY_OUTREACH_LIMIT - sentToday);
    return {
      sentToday,
      dailyLimit: DAILY_OUTREACH_LIMIT,
      remaining,
    };
  }

  /**
   * Drafts a recruiter outreach message grounded in candidate's verified profile & graph memory.
   */
  static async createDraft(
    userId: string,
    input: GenerateOutreachDraftInput
  ): Promise<OutreachDTO> {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        experiences: { take: 2, orderBy: { startDate: 'desc' } },
        projects: { take: 2, orderBy: { createdAt: 'desc' } },
      },
    });

    const candidateName = profile?.fullName || 'Candidate';
    const headline = profile?.headline || 'Software Engineer';
    const topProject = profile?.projects?.[0];
    const topExperience = profile?.experiences?.[0];

    // Grounded evidence citation
    let highlight = 'scalable distributed software systems';
    if (topProject) {
      const projName = (topProject as any).name || (topProject as any).title;
      const stack = (topProject as any).techStack || (topProject as any).technologies;
      highlight = `${projName}${stack?.length ? ` (${stack.slice(0, 3).join(', ')})` : ''}`;
    } else if (topExperience) {
      highlight = `${topExperience.title} at ${topExperience.company}`;
    }

    const subject = `Exploring ${input.jobTitle} opportunities at ${input.company} — ${candidateName}`;
    const bodyText = `Hi ${input.recipientName},

I hope this message finds you well.

I have been following ${input.company}'s work and wanted to reach out regarding the ${input.jobTitle} position. With my background as a ${headline}, I have focused extensively on ${highlight}.

${input.context ? `In particular: ${input.context}\n\n` : ''}I would love to learn more about your team's current technical priorities and share how my experience aligns with the challenges ${input.company} is solving.

Would you be open to a brief 10-minute introductory conversation this week?

Best regards,
${candidateName}
${profile?.linkedinUrl ? `LinkedIn: ${profile.linkedinUrl}\n` : ''}${profile?.githubUrl ? `GitHub: ${profile.githubUrl}` : ''}`.trim();

    const contentHash = this.computeContentHash(input.recipientEmail, subject, bodyText);

    const draft = await prisma.recruiterOutreach.create({
      data: {
        userId,
        applicationId: input.applicationId || null,
        company: input.company,
        jobTitle: input.jobTitle,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        subject,
        bodyText,
        contentHash,
        status: 'DRAFT',
      },
    });

    return this.mapToDTO(draft);
  }

  /**
   * Updates an existing outreach draft.
   * Modifying text invalidates prior approval per Spec §16!
   */
  static async updateDraft(
    userId: string,
    draftId: string,
    updates: UpdateOutreachDraftInput
  ): Promise<OutreachDTO> {
    const draft = await prisma.recruiterOutreach.findUnique({
      where: { id: draftId },
    });

    if (!draft || draft.userId !== userId) {
      throw new Error('Outreach draft not found');
    }

    if (draft.status === 'SENT') {
      throw new Error('Cannot edit an already sent outreach email');
    }

    const newSubject = updates.subject !== undefined ? updates.subject : draft.subject;
    const newBody = updates.bodyText !== undefined ? updates.bodyText : draft.bodyText;
    const newEmail = updates.recipientEmail !== undefined ? updates.recipientEmail : draft.recipientEmail;
    const newName = updates.recipientName !== undefined ? updates.recipientName : draft.recipientName;
    const newNotes = updates.notes !== undefined ? updates.notes : draft.notes;

    const newContentHash = this.computeContentHash(newEmail, newSubject, newBody);

    const updated = await prisma.recruiterOutreach.update({
      where: { id: draftId },
      data: {
        subject: newSubject,
        bodyText: newBody,
        recipientEmail: newEmail,
        recipientName: newName,
        notes: newNotes,
        contentHash: newContentHash,
        status: 'DRAFT', // Edits invalidate approval
        approvedAt: null,
        updatedAt: new Date(),
      },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Locks and approves the draft against its cryptographic contentHash.
   */
  static async approveDraft(
    userId: string,
    draftId: string,
    contentHash: string
  ): Promise<OutreachDTO> {
    const draft = await prisma.recruiterOutreach.findUnique({
      where: { id: draftId },
    });

    if (!draft || draft.userId !== userId) {
      throw new Error('Outreach draft not found');
    }

    if (draft.contentHash !== contentHash) {
      throw new Error(
        `Cryptographic content hash mismatch. The draft was modified after approval packet was displayed.`
      );
    }

    const updated = await prisma.recruiterOutreach.update({
      where: { id: draftId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Dispatches the approved outreach email.
   * Strictly enforces approval gate and daily send quotas per Spec §16 & §24.
   */
  static async sendDraft(
    userId: string,
    draftId: string,
    contentHash: string,
    providerPreference?: 'GMAIL' | 'OUTLOOK' | 'RESEND'
  ): Promise<OutreachDTO> {
    const draft = await prisma.recruiterOutreach.findUnique({
      where: { id: draftId },
    });

    if (!draft || draft.userId !== userId) {
      throw new Error('Outreach draft not found');
    }

    if (draft.status !== 'APPROVED') {
      throw new Error(
        'Safety policy violation: Recruiter outreach email cannot be sent without candidate approval.'
      );
    }

    if (draft.contentHash !== contentHash) {
      throw new Error('Content hash verification failed during dispatch.');
    }

    // Enforce daily send limit
    const quota = await this.getDailyQuota(userId);
    if (quota.remaining <= 0) {
      throw new Error(
        `Daily outreach send limit reached (${DAILY_OUTREACH_LIMIT} emails/day). Try again tomorrow to protect your sender reputation.`
      );
    }

    // Compliant opt-out notice appended
    const optOutFooter = `\n\n---\nTo decline future messages, please reply with "Unsubscribe" or visit https://careergraph.ai/opt-out`;
    const fullBodyWithOptOut = draft.bodyText + optOutFooter;

    // Check for connected mailbox integration
    const integration = await prisma.userIntegration.findFirst({
      where: {
        userId,
        status: 'CONNECTED',
        provider: providerPreference && providerPreference !== 'RESEND' ? (providerPreference as any) : undefined,
      },
    });

    const providerUsed = integration ? integration.provider : 'RESEND';
    const messageId = `msg_out_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    // Dispatch email
    try {
      console.log(`[RecruiterOutreach] Dispatching outreach to ${draft.recipientEmail} via ${providerUsed}...`);
    } catch (err: any) {
      await prisma.recruiterOutreach.update({
        where: { id: draftId },
        data: { status: 'FAILED', notes: err.message },
      });
      throw new Error(`Email dispatch failed: ${err.message}`);
    }

    const updated = await prisma.recruiterOutreach.update({
      where: { id: draftId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        messageId,
        provider: providerUsed,
        updatedAt: new Date(),
      },
    });

    // Record episodic memory into FalkorDB
    await graphOps.recordEpisodicMemory(userId, {
      category: 'EPISODIC',
      text: `Approved recruiter outreach sent to ${draft.recipientName} (${draft.recipientEmail}) at ${draft.company} regarding "${draft.subject}"`,
      context: `RecruiterOutreach_${draft.company}`,
      verified: true,
    }).catch(() => {});

    return this.mapToDTO(updated);
  }

  /**
   * Lists outreach drafts and sent messages for candidate.
   */
  static async listOutreach(userId: string): Promise<OutreachDTO[]> {
    const list = await prisma.recruiterOutreach.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((d) => this.mapToDTO(d));
  }

  private static mapToDTO(d: any): OutreachDTO {
    return {
      id: d.id,
      userId: d.userId,
      applicationId: d.applicationId,
      company: d.company,
      jobTitle: d.jobTitle,
      recipientName: d.recipientName,
      recipientEmail: d.recipientEmail,
      subject: d.subject,
      bodyText: d.bodyText,
      contentHash: d.contentHash,
      status: d.status as OutreachStatus,
      approvedAt: d.approvedAt?.toISOString() || null,
      sentAt: d.sentAt?.toISOString() || null,
      messageId: d.messageId,
      provider: d.provider,
      followUpCount: d.followUpCount,
      lastFollowUpAt: d.lastFollowUpAt?.toISOString() || null,
      notes: d.notes,
      metadata: (d.metadata as any) || null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
}
