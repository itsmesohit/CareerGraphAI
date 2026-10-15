import { prisma } from '@careergraph/db';
import { matchingService } from '../matching/matchingService.js';
import { ApplicationStateMachine } from './applicationStateMachine.js';
import { AIService } from '../ai/aiService.js';
import { getEmailService } from '../emailService.js';
import { env } from '../../config/env.js';
import type { ExecutionMode } from '@careergraph/shared';

export class OrchestratorService {
  /**
   * Prepares application workflow for a selected job posting.
   */
  static async prepareApplication(
    userId: string,
    jobId: string,
    mode: ExecutionMode = 'APPROVAL_REQUIRED',
    initialNotes?: string
  ) {
    // 1. Verify Job exists and is active
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: { requirements: true },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // 2. Check for duplicate application per user & job (Spec §13)
    let application = await prisma.application.findUnique({
      where: {
        userId_jobId: {
          userId,
          jobId,
        },
      },
      include: {
        events: true,
        missingItems: true,
      },
    });

    if (application && application.workflowStatus !== 'CANCELLED') {
      return application;
    }

    // Fetch user candidate profile and preferences
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        experiences: { orderBy: { createdAt: 'desc' } },
        educations: { orderBy: { createdAt: 'desc' } },
        skills: true,
        projects: { orderBy: { createdAt: 'desc' } },
        preferences: true,
        answers: { include: { canonicalQuestion: true } },
      },
    });

    if (!profile) {
      throw new Error('Candidate profile not found. Please complete profile onboarding.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    // 3. Create or Reset Application Record
    if (!application) {
      application = await prisma.application.create({
        data: {
          userId,
          jobId,
          stage: 'PREPARING',
          workflowStatus: 'JOB_VALIDATED',
          mode,
          notes: initialNotes,
          submissionChannel: 'MANUAL_FALLBACK',
        },
        include: {
          events: true,
          missingItems: true,
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          eventType: 'APPLICATION_CREATED',
          fromStatus: null,
          toStatus: 'JOB_VALIDATED',
          actorType: 'USER',
          actorId: userId,
          title: 'Application Initialized',
          description: `Application initialized for ${job.title} at ${job.company}.`,
        },
      });
    }

    // 4. Run Deterministic Match
    const match = await matchingService.evaluateMatch(userId, jobId);

    await prisma.application.update({
      where: { id: application.id },
      data: {
        matchScore: match.overallScore,
        decisionExplanation: match.conciseExplanation,
        workflowStatus: 'PROFILE_MATCHED',
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        eventType: 'PROFILE_MATCHED',
        fromStatus: 'JOB_VALIDATED',
        toStatus: 'PROFILE_MATCHED',
        actorType: 'AGENT',
        title: `Profile Matched (${match.overallScore}%)`,
        description: match.conciseExplanation,
      },
    });

    // 5. Load Universal Answers and Evaluate Screening Questions
    const candidateAnswers = (profile.answers || []).map((a) => ({
      questionKey: a.questionKey,
      questionText: a.canonicalQuestion?.questionText || a.questionKey,
      answerText: a.value,
      category: a.canonicalQuestion?.category,
    }));

    const missingSkills = match.missingRequirements
      .filter((r) => r.isHardConstraint && r.skill)
      .map((r) => r.skill as string);

    const questionResult = await AIService.evaluateQuestions({
      company: job.company,
      jobTitle: job.title,
      requirements: job.requirements,
      candidateAnswers,
      candidatePreferences: profile.preferences,
      missingSkills,
    });

    // 6. If Missing Information is flagged, pause workflow and notify candidate
    if (questionResult.missingItems.length > 0) {
      // Clear existing pending items if any
      await prisma.missingInfoRequest.deleteMany({
        where: { applicationId: application.id, status: 'PENDING' },
      });

      // Create new missing info requests
      for (const item of questionResult.missingItems) {
        await prisma.missingInfoRequest.create({
          data: {
            userId,
            applicationId: application.id,
            jobId,
            questionKey: item.questionKey,
            questionText: item.questionText,
            category: item.category,
            reason: item.reason,
            suggestedAnswer: item.suggestedAnswer,
            status: 'PENDING',
          },
        });
      }

      const pausedApp = await prisma.application.update({
        where: { id: application.id },
        data: {
          workflowStatus: 'WAITING_FOR_USER',
          preparedAnswers: questionResult.preparedAnswers as any,
          lastActivityAt: new Date(),
        },
        include: {
          events: true,
          missingItems: true,
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          eventType: 'MISSING_INFO_REQUESTED',
          fromStatus: 'PROFILE_MATCHED',
          toStatus: 'WAITING_FOR_USER',
          actorType: 'AGENT',
          title: `Action Required: ${questionResult.missingItems.length} Missing Information Items`,
          description: `Questions needed before completing submission packet: ${questionResult.missingItems.map((m) => m.questionText).join('; ')}`,
        },
      });

      // Send email alert to user
      if (user?.email) {
        getEmailService()
          .sendNotificationEmail({
            to: user.email,
            subject: `[Action Required] Details needed for ${job.company} (${job.title})`,
            heading: `Details Needed for ${job.company}`,
            messageText: `CareerGraph AI is preparing your tailored application package for <strong>${job.title}</strong> at <strong>${job.company}</strong>, but requires verified details from you before finalizing.<br><br><strong>Question:</strong> "${questionResult.missingItems[0].questionText}"`,
            badgeText: 'Action Required',
            badgeColor: '#f59e0b',
            metadata: [
              { label: 'Company', value: job.company },
              { label: 'Role', value: job.title },
              { label: 'Pending Items', value: `${questionResult.missingItems.length} question(s)` },
            ],
            actionLabel: 'Resolve in Missing Info Inbox',
            actionUrl: `${env.WEB_URL || 'http://localhost:5173'}/missing-info`,
          })
          .catch((err) => console.warn('[Orchestrator Notification Error]:', err.message));
      }

      return pausedApp;
    }

    // 7. All information available: Finalize preparation with specialist agents
    return this.finalizePreparation(application.id, profile, job, match, questionResult.preparedAnswers);
  }

  /**
   * Finalizes tailored documents, computes cryptographic content hash,
   * transitions state to AWAITING_APPROVAL or READY_TO_SUBMIT, and dispatches notification.
   */
  static async finalizePreparation(
    applicationId: string,
    profile: any,
    job: any,
    match: any,
    preparedAnswers: any
  ) {
    const tailoredResume = await AIService.tailorResume({
      jobTitle: job.title,
      company: job.company,
      requiredSkills: job.skills || [],
      candidateExperiences: (profile.experiences || []).map((e: any) => ({
        title: e.title,
        company: e.company,
        bullets: e.description ? [e.description, ...(e.metrics || [])] : (e.metrics || []),
        skills: e.technologies || e.skills || [],
      })),
      candidateProjects: (profile.projects || []).map((p: any) => ({
        title: p.name || p.title || 'Key Engineering Project',
        description: p.description,
        skills: p.techStack || p.skills || [],
        metrics: p.role || p.metrics,
      })),
    });

    const coverLetter = await AIService.draftCoverLetter({
      candidateName: profile.fullName || 'Candidate',
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      matchedSkills: match.matchedSkills.map((s: any) => s.skill),
      topProject: profile.projects[0] || null,
      topExperience: profile.experiences[0] || null,
    });

    const contentHash = ApplicationStateMachine.computeContentHash({
      jobId: job.id,
      company: job.company,
      coverLetterText: coverLetter,
      preparedAnswers,
    });

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) throw new Error('Application not found');

    const nextStatus = application.mode === 'AUTO_APPLY' ? 'READY_TO_SUBMIT' : 'AWAITING_APPROVAL';

    const updatedApp = await prisma.application.update({
      where: { id: applicationId },
      data: {
        workflowStatus: nextStatus,
        tailoredResumeJson: tailoredResume as any,
        coverLetterText: coverLetter,
        preparedAnswers: preparedAnswers as any,
        contentHash,
        approvalRequestedAt: new Date(),
        lastActivityAt: new Date(),
      },
      include: {
        events: true,
        missingItems: true,
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        eventType: 'APPLICATION_PREPARED',
        fromStatus: application.workflowStatus,
        toStatus: nextStatus,
        actorType: 'AGENT',
        title: nextStatus === 'AWAITING_APPROVAL' ? 'Application Ready for Candidate Approval' : 'Ready to Submit',
        description: `Generated tailored resume bullets, grounded cover letter, and computed cryptographic content hash: ${contentHash.slice(0, 12)}...`,
        metadata: { contentHash },
      },
    });

    // Send Approval Email if awaiting candidate review
    if (nextStatus === 'AWAITING_APPROVAL' && application.user?.email) {
      getEmailService()
        .sendNotificationEmail({
          to: application.user.email,
          subject: `[Approval Needed] Application Ready: ${job.company} (${job.title})`,
          heading: 'Application Package Ready for Review',
          messageText: `Your graph-tailored application package for <strong>${job.title}</strong> at <strong>${job.company}</strong> (Deterministic Match: ${match.overallScore}%) is ready for your review and approval.<br><br><strong>Content Hash:</strong> <code>${contentHash.slice(0, 16)}...</code>`,
          badgeText: 'Approval Needed',
          badgeColor: '#6366f1',
          metadata: [
            { label: 'Company', value: job.company },
            { label: 'Role', value: job.title },
            { label: 'Match Score', value: `${match.overallScore}%` },
            { label: 'Content Hash', value: `${contentHash.slice(0, 12)}...` },
          ],
          actionLabel: 'Review in Approval Center',
          actionUrl: `${env.WEB_URL || 'http://localhost:5173'}/approvals`,
        })
        .catch((err) => console.warn('[Orchestrator Notification Error]:', err.message));
    }

    return updatedApp;
  }
}
