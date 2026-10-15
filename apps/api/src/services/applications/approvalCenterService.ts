import { prisma, graphOps } from '@careergraph/db';
import { ApplicationStateMachine } from './applicationStateMachine.js';
import { getEmailService } from '../emailService.js';
import type { SubmissionChannel } from '@careergraph/shared';

export class ApprovalCenterService {
  /**
   * Lists all applications awaiting candidate approval.
   */
  static async listPendingApprovals(userId: string) {
    const applications = await prisma.application.findMany({
      where: {
        userId,
        workflowStatus: 'AWAITING_APPROVAL',
      },
      include: {
        job: true,
      },
      orderBy: { approvalRequestedAt: 'desc' },
    });

    return applications.map((app) => ({
      id: app.id,
      userId: app.userId,
      jobId: app.jobId,
      company: app.job.company,
      jobTitle: app.job.title,
      location: app.job.location,
      remoteType: app.job.remoteType,
      applyUrl: app.job.applyUrl || app.job.jobUrl,
      jobUrl: app.job.jobUrl,
      stage: app.stage,
      workflowStatus: app.workflowStatus,
      mode: app.mode,
      matchScore: app.matchScore,
      contentHash: app.contentHash,
      tailoredResumeJson: app.tailoredResumeJson,
      coverLetterText: app.coverLetterText,
      preparedAnswers: app.preparedAnswers,
      submissionChannel: app.submissionChannel,
      approvalRequestedAt: app.approvalRequestedAt?.toISOString() || null,
      createdAt: app.createdAt.toISOString(),
    }));
  }

  /**
   * Approves application submission. Validates cryptographic content-hash match (Spec §15).
   */
  static async approveApplication(
    userId: string,
    applicationId: string,
    contentHash: string,
    channel: SubmissionChannel = 'MANUAL_FALLBACK',
    overrideCoverLetter?: string
  ) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true, user: true },
    });

    if (!app || app.userId !== userId) {
      throw new Error('Application not found');
    }

    if (app.workflowStatus !== 'AWAITING_APPROVAL') {
      throw new Error(`Application is not awaiting approval (current status: ${app.workflowStatus})`);
    }

    // If candidate edited the cover letter, recompute hash
    let effectiveHash = app.contentHash;
    if (overrideCoverLetter && overrideCoverLetter !== app.coverLetterText) {
      effectiveHash = ApplicationStateMachine.computeContentHash({
        jobId: app.jobId,
        company: app.job.company,
        coverLetterText: overrideCoverLetter,
        preparedAnswers: app.preparedAnswers as any,
      });

      await prisma.application.update({
        where: { id: applicationId },
        data: {
          coverLetterText: overrideCoverLetter,
          contentHash: effectiveHash,
        },
      });
    }

    // Strict Content Hash Verification Gate
    if (effectiveHash !== contentHash) {
      throw new Error(
        `[SECURITY] Content hash mismatch: Expected "${effectiveHash}", received "${contentHash}". The application payload was modified since generation.`
      );
    }

    // Step 1: Transition to READY_TO_SUBMIT
    await ApplicationStateMachine.transition({
      applicationId,
      fromStatus: 'AWAITING_APPROVAL',
      toStatus: 'READY_TO_SUBMIT',
      actorType: 'USER',
      actorId: userId,
      title: 'Candidate Approved Application',
      description: `Cryptographic content hash ${contentHash.slice(0, 16)}... confirmed and approved by candidate.`,
      metadata: { contentHash, channel },
    });

    // Step 2: Execute submission transition
    const submissionId = `SUBMIT_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const submissionSnapshot = {
      submittedAt: new Date().toISOString(),
      channel,
      confirmationId: submissionId,
      contentHash,
      jobTitle: app.job.title,
      company: app.job.company,
      coverLetterText: overrideCoverLetter || app.coverLetterText,
      tailoredResumeJson: app.tailoredResumeJson,
      preparedAnswers: app.preparedAnswers,
    };

    const finalApp = await prisma.application.update({
      where: { id: applicationId },
      data: {
        stage: 'APPLIED',
        workflowStatus: 'SUBMITTED',
        submissionChannel: channel,
        submissionConfirmationId: submissionId,
        submissionSnapshot,
        approvedAt: new Date(),
        approvedByUserId: userId,
        appliedAt: new Date(),
        lastActivityAt: new Date(),
      },
      include: {
        job: true,
        events: true,
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        eventType: 'APPLICATION_SUBMITTED',
        fromStatus: 'READY_TO_SUBMIT',
        toStatus: 'SUBMITTED',
        actorType: 'SYSTEM',
        title: `Submission Confirmed via ${channel}`,
        description: `Submission executed with confirmation ID: ${submissionId}`,
        metadata: { submissionId, channel },
      },
    });

    // Record Episodic Memory in graph
    await graphOps.recordEpisodicMemory(userId, {
      category: 'EPISODIC',
      text: `Submitted application for ${app.job.title} at ${app.job.company}. Confirmation ID: ${submissionId}`,
      context: `Submission_${app.job.company}`,
      verified: true,
    });

    // Send confirmation email
    if (app.user?.email) {
      getEmailService()
        .sendNotificationEmail({
          to: app.user.email,
          subject: `[Submitted] Application Sent: ${app.job.company} (${app.job.title})`,
          heading: 'Application Successfully Processed!',
          messageText: `Your tailored application package has been approved and registered for <strong>${app.job.company}</strong>.<br><br>Confirmation ID: <code>${submissionId}</code>.<br><br>You can track application stages, recruiter responses, and interview rounds in your Application Tracker.`,
          badgeText: 'Submitted',
          badgeColor: '#10b981',
          metadata: [
            { label: 'Company', value: app.job.company },
            { label: 'Role', value: app.job.title },
            { label: 'Channel', value: channel },
            { label: 'Confirmation ID', value: submissionId },
          ],
          actionLabel: 'View in Application Tracker',
          actionUrl: `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/applications`,
        })
        .catch((err) => console.warn('[ApprovalCenter Email Error]:', err.message));
    }

    return finalApp;
  }

  /**
   * Rejects an application or marks it cancelled.
   */
  static async rejectApplication(userId: string, applicationId: string, reason?: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!app || app.userId !== userId) {
      throw new Error('Application not found');
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        workflowStatus: 'CANCELLED',
        rejectionReason: reason,
        lastActivityAt: new Date(),
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        eventType: 'APPLICATION_REJECTED_BY_USER',
        fromStatus: app.workflowStatus,
        toStatus: 'CANCELLED',
        actorType: 'USER',
        actorId: userId,
        title: 'Application Cancelled by Candidate',
        description: reason || 'Candidate rejected draft application.',
      },
    });

    return updated;
  }

  /**
   * Bulk approves multiple applications simultaneously.
   */
  static async bulkApprove(
    userId: string,
    approvals: Array<{ applicationId: string; contentHash: string }>
  ) {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const item of approvals) {
      try {
        await this.approveApplication(userId, item.applicationId, item.contentHash);
        results.push({ id: item.applicationId, success: true });
      } catch (err: any) {
        results.push({ id: item.applicationId, success: false, error: err.message });
      }
    }

    return results;
  }
}
