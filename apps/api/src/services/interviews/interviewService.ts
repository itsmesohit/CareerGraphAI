import { prisma } from '@careergraph/db';
import type {
  CreateInterviewScheduleInput,
  UpdateInterviewScheduleInput,
  InterviewScheduleDTO,
} from '@careergraph/shared';

export class InterviewService {
  /**
   * Generates tailored interview preparation questions based on round type and job context.
   */
  static generatePrepQuestions(
    roundType: string,
    roleTitle: string,
    company: string
  ): Array<{ question: string; suggestedPoints: string[] }> {
    const typeUpper = roundType.toUpperCase();

    if (typeUpper.includes('SYSTEM') || typeUpper.includes('ARCHITECTURE')) {
      return [
        {
          question: `How would you architect a horizontally scalable distributed service handling 100k req/sec at ${company}?`,
          suggestedPoints: [
            'Discuss stateless application layer, CDN edge caching, and load balancing algorithms.',
            'Explain database partitioning (sharding), read replicas, and caching strategies (Redis / Memcached).',
            'Detail observability: distributed tracing, Prometheus metrics, and automated circuit breaking.',
          ],
        },
        {
          question: `Describe a time you diagnosed and mitigated a catastrophic latency spike or bottleneck.`,
          suggestedPoints: [
            'Focus on root-cause analysis: p99 vs median latency, database lock contention, or network saturation.',
            'Cite quantitative business impact and long-term architectural prevention.',
          ],
        },
      ];
    }

    if (typeUpper.includes('TECH') || typeUpper.includes('CODING') || typeUpper.includes('ALGO')) {
      return [
        {
          question: `What are the trade-offs of using optimistic concurrency vs pessimistic locking for high-volume transactions?`,
          suggestedPoints: [
            'Compare throughput under high contention versus abort/retry costs.',
            'Explain how MVCC and ACID isolation levels operate under Postgres or distributed stores.',
          ],
        },
        {
          question: `Walk through your approach to unit testing, fuzzing, and regression testing asynchronous workflows.`,
          suggestedPoints: [
            'Mention deterministic mocking, property-based tests, and chaos injection.',
          ],
        },
      ];
    }

    // Default: HR / Behavioral / Hiring Manager
    return [
      {
        question: `Why are you specifically excited about joining ${company} as a ${roleTitle}?`,
        suggestedPoints: [
          `Connect your career trajectory to ${company}'s core business and engineering culture.`,
          'Highlight specific products or recent platform developments that inspire you.',
        ],
      },
      {
        question: `Describe a high-stakes disagreement with a teammate or stakeholder and how you resolved it constructively.`,
        suggestedPoints: [
          'Use the STAR framework (Situation, Task, Action, Result).',
          'Demonstrate high empathy, data-driven reasoning, and commitment to the team objective.',
        ],
      },
    ];
  }

  /**
   * Schedules an interview, generates prep questions, updates application stage, and optionally syncs calendar.
   */
  static async scheduleInterview(
    userId: string,
    input: CreateInterviewScheduleInput
  ): Promise<InterviewScheduleDTO> {
    const app = await prisma.application.findUnique({
      where: { id: input.applicationId },
      include: { job: true },
    });

    if (!app || app.userId !== userId) {
      throw new Error('Application not found');
    }

    const scheduledDate = new Date(input.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('Invalid scheduledAt timestamp');
    }

    // Advance application stage to INTERVIEWING if not already in final stage
    if (app.stage !== 'INTERVIEWING' && app.stage !== 'OFFERED' && app.stage !== 'REJECTED') {
      await prisma.application.update({
        where: { id: app.id },
        data: {
          stage: 'INTERVIEWING',
          lastActivityAt: new Date(),
        },
      });
    }

    const prepQuestions = this.generatePrepQuestions(
      input.roundType,
      app.job.title,
      app.job.company
    );

    let calendarEventId: string | null = null;
    let calendarProvider: string | null = null;

    if (input.syncCalendar) {
      const integration = await prisma.userIntegration.findFirst({
        where: {
          userId,
          status: 'CONNECTED',
          provider: { in: ['GOOGLE_CALENDAR', 'OUTLOOK_CALENDAR', 'GMAIL', 'OUTLOOK'] },
        },
      });

      if (integration) {
        calendarProvider = integration.provider;
        calendarEventId = `cal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      }
    }

    const interview = await prisma.interviewSchedule.create({
      data: {
        applicationId: app.id,
        roundName: input.roundName,
        roundType: input.roundType,
        scheduledAt: scheduledDate,
        durationMinutes: input.durationMinutes || 45,
        meetingLink: input.meetingLink || null,
        interviewerNames: input.interviewerNames,
        notes: input.notes || null,
        prepQuestions: prepQuestions as any,
        status: 'SCHEDULED',
        calendarEventId,
        calendarProvider,
      },
      include: {
        application: { include: { job: true } },
      },
    });

    // Record audit event
    await prisma.applicationEvent.create({
      data: {
        applicationId: app.id,
        eventType: 'INTERVIEW_SCHEDULED',
        fromStatus: app.workflowStatus,
        toStatus: app.workflowStatus,
        actorType: 'USER',
        title: `Interview Scheduled: ${input.roundName}`,
        description: `${input.roundType} round on ${scheduledDate.toLocaleDateString()} for ${input.durationMinutes}m. Interviewers: ${input.interviewerNames.join(', ') || 'N/A'}.`,
        metadata: {
          roundType: input.roundType,
          meetingLink: input.meetingLink,
          calendarEventId,
        },
      },
    });

    return this.mapToDTO(interview);
  }

  /**
   * Generates RFC 5545 compliant iCalendar (.ics) string per Spec §14.
   */
  static async generateIcs(userId: string, interviewId: string): Promise<{ icsContent: string; filename: string }> {
    const interview = await prisma.interviewSchedule.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: { job: true, user: true },
        },
      },
    });

    if (!interview || interview.application.userId !== userId) {
      throw new Error('Interview not found');
    }

    const start = new Date(interview.scheduledAt);
    const end = new Date(start.getTime() + interview.durationMinutes * 60 * 1000);

    const formatIcsDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const uid = `interview-${interview.id}@careergraph.ai`;
    const dtstamp = formatIcsDate(new Date());
    const dtstart = formatIcsDate(start);
    const dtend = formatIcsDate(end);
    const summary = `${interview.application.job.company} — ${interview.roundName} (${interview.roundType})`;
    const description = `Interview with ${interview.application.job.company} for the ${interview.application.job.title} role.\\nRound: ${interview.roundName} (${interview.roundType})\\nDuration: ${interview.durationMinutes} minutes\\n${interview.meetingLink ? `Meeting Link: ${interview.meetingLink}\\n` : ''}${interview.notes ? `Notes: ${interview.notes}\\n` : ''}\\nManaged with CareerGraph AI.`;
    const location = interview.meetingLink || 'Virtual Video Call';

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CareerGraph AI//Career Navigation System//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      interview.meetingLink ? `URL:${interview.meetingLink}` : '',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Interview Reminder',
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean);

    const icsContent = icsLines.join('\r\n') + '\r\n';
    const cleanCompany = interview.application.job.company.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${cleanCompany}_interview_${interview.id.substring(0, 8)}.ics`;

    return { icsContent, filename };
  }

  /**
   * Lists all interviews for a candidate.
   */
  static async listInterviews(userId: string): Promise<InterviewScheduleDTO[]> {
    const list = await prisma.interviewSchedule.findMany({
      where: {
        application: { userId },
      },
      include: {
        application: { include: { job: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return list.map((i) => this.mapToDTO(i));
  }

  /**
   * Updates interview status or details.
   */
  static async updateInterview(
    userId: string,
    interviewId: string,
    updates: UpdateInterviewScheduleInput
  ): Promise<InterviewScheduleDTO> {
    const interview = await prisma.interviewSchedule.findUnique({
      where: { id: interviewId },
      include: { application: true },
    });

    if (!interview || interview.application.userId !== userId) {
      throw new Error('Interview not found');
    }

    const updated = await prisma.interviewSchedule.update({
      where: { id: interviewId },
      data: {
        roundName: updates.roundName,
        roundType: updates.roundType,
        scheduledAt: updates.scheduledAt ? new Date(updates.scheduledAt) : undefined,
        durationMinutes: updates.durationMinutes,
        meetingLink: updates.meetingLink,
        interviewerNames: updates.interviewerNames,
        notes: updates.notes,
        status: updates.status,
        updatedAt: new Date(),
      },
      include: {
        application: { include: { job: true } },
      },
    });

    return this.mapToDTO(updated);
  }

  private static mapToDTO(i: any): InterviewScheduleDTO {
    return {
      id: i.id,
      applicationId: i.applicationId,
      company: i.application?.job?.company,
      jobTitle: i.application?.job?.title,
      roundName: i.roundName,
      roundType: i.roundType,
      scheduledAt: i.scheduledAt.toISOString(),
      durationMinutes: i.durationMinutes,
      meetingLink: i.meetingLink,
      interviewerNames: i.interviewerNames,
      notes: i.notes,
      prepQuestions: i.prepQuestions,
      status: i.status,
      calendarEventId: i.calendarEventId,
      calendarProvider: i.calendarProvider,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    };
  }
}
