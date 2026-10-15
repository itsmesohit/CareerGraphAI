import { prisma, graphOps } from '@careergraph/db';
import type {
  ApplicationStage,
  ApplicationSummaryDTO,
  ApplicationDetailDTO,
  ApplicationPacketDTO,
  AddInterviewScheduleInput,
} from '@careergraph/shared';

export class ApplicationTrackerService {
  /**
   * Lists applications with summary data and metrics for Kanban, Table, and Calendar views.
   */
  static async listApplications(
    userId: string,
    filters?: {
      stage?: ApplicationStage;
      search?: string;
    }
  ): Promise<ApplicationSummaryDTO[]> {
    const whereClause: any = { userId };

    if (filters?.stage) {
      whereClause.stage = filters.stage;
    }

    if (filters?.search) {
      whereClause.job = {
        OR: [
          { company: { contains: filters.search, mode: 'insensitive' } },
          { title: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        job: true,
        missingItems: { where: { status: 'PENDING' } },
      },
      orderBy: { lastActivityAt: 'desc' },
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
      submissionChannel: app.submissionChannel,
      contentHash: app.contentHash,
      pendingMissingCount: app.missingItems.length,
      isApprovalNeeded: app.workflowStatus === 'AWAITING_APPROVAL',
      appliedAt: app.appliedAt?.toISOString() || null,
      lastActivityAt: app.lastActivityAt.toISOString(),
      createdAt: app.createdAt.toISOString(),
    }));
  }

  /**
   * Retrieves full application details with timeline events, interview schedules, and snapshot.
   */
  static async getApplicationDetail(userId: string, applicationId: string): Promise<ApplicationDetailDTO> {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
        events: { orderBy: { createdAt: 'desc' } },
        missingItems: { orderBy: { createdAt: 'desc' } },
        interviews: { orderBy: { scheduledAt: 'asc' } },
      },
    });

    if (!app || app.userId !== userId) {
      throw new Error('Application not found');
    }

    const pendingMissing = app.missingItems.filter((m) => m.status === 'PENDING').length;

    return {
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
      submissionChannel: app.submissionChannel,
      contentHash: app.contentHash,
      pendingMissingCount: pendingMissing,
      isApprovalNeeded: app.workflowStatus === 'AWAITING_APPROVAL',
      appliedAt: app.appliedAt?.toISOString() || null,
      lastActivityAt: app.lastActivityAt.toISOString(),
      createdAt: app.createdAt.toISOString(),
      decisionExplanation: app.decisionExplanation,
      tailoredResumeId: app.tailoredResumeId,
      tailoredResumeJson: app.tailoredResumeJson,
      coverLetterText: app.coverLetterText,
      preparedAnswers: (app.preparedAnswers as any) || {},
      submissionConfirmationId: app.submissionConfirmationId,
      submissionSnapshot: app.submissionSnapshot,
      rejectionReason: app.rejectionReason,
      notes: app.notes,
      events: app.events.map((e) => ({
        id: e.id,
        applicationId: e.applicationId,
        eventType: e.eventType,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorType: e.actorType,
        actorId: e.actorId,
        title: e.title,
        description: e.description,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
      })),
      missingItems: app.missingItems.map((m) => ({
        id: m.id,
        userId: m.userId,
        applicationId: m.applicationId,
        jobId: m.jobId,
        companyName: app.job.company,
        jobTitle: app.job.title,
        questionKey: m.questionKey,
        questionText: m.questionText,
        category: m.category,
        reason: m.reason,
        suggestedAnswer: m.suggestedAnswer,
        candidateAnswer: m.candidateAnswer,
        answerScope: m.answerScope,
        status: m.status as any,
        resolvedAt: m.resolvedAt?.toISOString() || null,
        createdAt: m.createdAt.toISOString(),
      })),
      interviews: app.interviews.map((i) => ({
        id: i.id,
        applicationId: i.applicationId,
        roundName: i.roundName,
        roundType: i.roundType,
        scheduledAt: i.scheduledAt.toISOString(),
        durationMinutes: i.durationMinutes,
        meetingLink: i.meetingLink,
        interviewerNames: i.interviewerNames,
        notes: i.notes,
        prepQuestions: (i.prepQuestions as any) || null,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Updates the pipeline tracking stage (for Kanban drag & drop or manual updates).
   */
  static async updateStage(
    userId: string,
    applicationId: string,
    newStage: ApplicationStage,
    rejectionReason?: string,
    notes?: string
  ) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    if (!app || app.userId !== userId) {
      throw new Error('Application not found');
    }

    const previousStage = app.stage;

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        stage: newStage,
        rejectionReason: rejectionReason || app.rejectionReason,
        notes: notes ? (app.notes ? `${app.notes}\n${notes}` : notes) : app.notes,
        lastActivityAt: new Date(),
        appliedAt: newStage === 'APPLIED' && !app.appliedAt ? new Date() : app.appliedAt,
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        eventType: 'STAGE_CHANGED',
        fromStatus: previousStage,
        toStatus: newStage,
        actorType: 'USER',
        actorId: userId,
        title: `Pipeline Stage Moved: ${previousStage} → ${newStage}`,
        description: rejectionReason ? `Reason: ${rejectionReason}` : `Stage changed by candidate to ${newStage}`,
        metadata: { previousStage, newStage, rejectionReason },
      },
    });

    // Sync to FalkorDB
    await graphOps.recordEpisodicMemory(userId, {
      category: 'EPISODIC',
      text: `Application for ${app.job.title} at ${app.job.company} moved to stage ${newStage}.`,
      context: `StageChange_${newStage}`,
      verified: true,
    });

    return updated;
  }

  /**
   * Schedules an interview round for the application.
   */
  static async addInterviewSchedule(
    userId: string,
    applicationId: string,
    input: AddInterviewScheduleInput
  ) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    if (!app || app.userId !== userId) {
      throw new Error('Application not found');
    }

    const interview = await prisma.interviewSchedule.create({
      data: {
        applicationId,
        roundName: input.roundName,
        roundType: input.roundType,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
        meetingLink: input.meetingLink || null,
        interviewerNames: input.interviewerNames,
        notes: input.notes,
        prepQuestions: (input.prepQuestions as any) || null,
      },
    });

    // Auto-advance stage to INTERVIEWING if in early stage
    if (app.stage === 'APPLIED' || app.stage === 'SAVED' || app.stage === 'SCREENING') {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          stage: 'INTERVIEWING',
          lastActivityAt: new Date(),
        },
      });
    }

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        eventType: 'INTERVIEW_SCHEDULED',
        actorType: 'USER',
        actorId: userId,
        title: `Interview Scheduled: ${input.roundName} (${input.roundType})`,
        description: `Scheduled for ${new Date(input.scheduledAt).toLocaleString()}. Duration: ${input.durationMinutes} min.`,
        metadata: { interviewId: interview.id, roundName: input.roundName },
      },
    });

    return interview;
  }

  /**
   * Adds a candidate note or recruiter contact details.
   */
  static async addNote(userId: string, applicationId: string, noteText: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!app || app.userId !== userId) {
      throw new Error('Application not found');
    }

    const updatedNotes = app.notes ? `${app.notes}\n• [${new Date().toLocaleDateString()}]: ${noteText}` : `• [${new Date().toLocaleDateString()}]: ${noteText}`;

    return prisma.application.update({
      where: { id: applicationId },
      data: {
        notes: updatedNotes,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Generates a complete manual application packet with copyable answers,
   * tailored bullets, cover letter, and direct apply link (Spec §13 channel E).
   */
  static async generateManualPacket(userId: string, applicationId: string): Promise<ApplicationPacketDTO> {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    if (!app || app.userId !== userId) {
      throw new Error('Application not found');
    }

    const tailoredJson: any = app.tailoredResumeJson || {};
    const preparedAnswers: any = app.preparedAnswers || {};

    const formattedAnswers = Object.keys(preparedAnswers).map((key) => {
      const item = preparedAnswers[key];
      return {
        key,
        question: typeof item === 'object' ? item.question : key,
        answer: typeof item === 'object' ? item.answer : String(item),
      };
    });

    return {
      applicationId: app.id,
      jobId: app.jobId,
      company: app.job.company,
      jobTitle: app.job.title,
      applyUrl: app.job.applyUrl || app.job.jobUrl,
      contentHash: app.contentHash || 'PENDING_GENERATION',
      tailoredBullets: tailoredJson.tailoredBullets || [],
      coverLetterText: app.coverLetterText || '',
      preparedAnswers: formattedAnswers,
      generatedAt: new Date().toISOString(),
    };
  }
}
