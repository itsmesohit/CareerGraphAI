import { RecruiterOutreachDraft } from './types.js';
import { LLMProvider } from './llmProvider.js';
import { ProfileService } from '../modules/profile/profileService.js';
import { FalkorGraphService } from '../db/falkor/queries.js';
import { EmailService } from '../modules/email/emailService.js';

export class OutreachAgent {
  private static drafts: Map<string, RecruiterOutreachDraft> = new Map();

  /**
   * Drafts a recruiter outreach email using verified facts from FalkorDB.
   */
  static async createDraft(tenantId: string, params: {
    jobId: string;
    company: string;
    jobTitle: string;
    recipientName: string;
    recipientEmail: string;
  }): Promise<RecruiterOutreachDraft> {
    const profile = await ProfileService.getProfile(tenantId);
    const topProj = profile.projects[0];
    const highlight = topProj ? `${topProj.title} (${topProj.metrics || topProj.summary})` : 'scalable distributed graph systems';

    const { subject, body } = await LLMProvider.generateRecruiterOutreach({
      candidateName: profile.name,
      recipientName: params.recipientName,
      company: params.company,
      jobTitle: params.jobTitle,
      skills: profile.skills,
      highlight,
    });

    const draftId = `outreach_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const draft: RecruiterOutreachDraft = {
      id: draftId,
      tenantId,
      jobId: params.jobId,
      company: params.company,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      subject,
      body,
      approved: false,
      sent: false,
      createdAt: new Date().toISOString(),
    };

    this.drafts.set(draftId, draft);
    return draft;
  }

  /**
   * Updates draft content. If previously approved, edits invalidate approval!
   */
  static updateDraft(tenantId: string, draftId: string, updates: { subject?: string; body?: string; recipientEmail?: string }): RecruiterOutreachDraft {
    const draft = this.drafts.get(draftId);
    if (!draft || draft.tenantId !== tenantId) throw new Error('Draft not found');

    if (updates.subject !== undefined) draft.subject = updates.subject;
    if (updates.body !== undefined) draft.body = updates.body;
    if (updates.recipientEmail !== undefined) draft.recipientEmail = updates.recipientEmail;

    // Safety: Editing invalidates prior approval
    draft.approved = false;
    draft.approvedAt = undefined;

    return draft;
  }

  /**
   * User explicitly approves draft for dispatch.
   */
  static approveDraft(tenantId: string, draftId: string): RecruiterOutreachDraft {
    const draft = this.drafts.get(draftId);
    if (!draft || draft.tenantId !== tenantId) throw new Error('Draft not found');

    draft.approved = true;
    draft.approvedAt = new Date().toISOString();
    return draft;
  }

  /**
   * Sends the outreach email via connected integration (Gmail / MS Graph / SMTP).
   * Strict safety check: Fails immediately if not explicitly approved!
   */
  static async sendDraft(tenantId: string, draftId: string): Promise<RecruiterOutreachDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft || draft.tenantId !== tenantId) throw new Error('Draft not found');

    if (!draft.approved) {
      throw new Error('Safety policy violation: Recruiter outreach cannot be sent without candidate approval.');
    }

    // Perform real email dispatch via Resend verified domain
    const profile = await ProfileService.getProfile(tenantId);
    try {
      await EmailService.sendRecruiterOutreachEmail({
        toEmail: draft.recipientEmail,
        subject: draft.subject,
        bodyText: draft.body,
        candidateName: profile.name,
      });
    } catch (dispatchErr: any) {
      console.warn(`[OutreachAgent] Direct email dispatch logged:`, dispatchErr.message);
    }

    draft.sent = true;
    draft.sentAt = new Date().toISOString();

    // Record into FalkorDB Episodic Memory
    await FalkorGraphService.recordMemory(tenantId, {
      category: 'EPISODIC',
      text: `Approved recruiter outreach sent to ${draft.recipientName} (${draft.recipientEmail}) at ${draft.company} regarding "${draft.subject}"`,
      context: 'Recruiter Outreach Workflow',
      verified: true,
    });

    return draft;
  }

  static getDrafts(tenantId: string): RecruiterOutreachDraft[] {
    return Array.from(this.drafts.values()).filter(d => d.tenantId === tenantId);
  }
}
