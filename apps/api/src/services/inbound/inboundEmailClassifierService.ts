import { prisma, EmailClassificationCategory } from '@careergraph/db';
import { ApplicationStateMachine } from '../applications/applicationStateMachine.js';
import type {
  ClassifyInboundEmailInput,
  InboundEmailEventDTO,
  ResolveInboundEmailInput,
} from '@careergraph/shared';

interface ClassificationResult {
  category: EmailClassificationCategory;
  confidence: number;
  suggestedStatus: string | null;
  matchedCompany?: string;
}

export class InboundEmailClassifierService {
  /**
   * Deterministic NLP/Regex classification engine for candidate emails per Spec §14.
   */
  static classifyText(subject: string, snippet: string): ClassificationResult {
    const combined = `${subject} ${snippet}`.toLowerCase();

    // 1. Offer Received
    if (
      combined.includes('pleased to offer') ||
      combined.includes('offer of employment') ||
      combined.includes('formal job offer') ||
      combined.includes('attached your offer letter') ||
      (combined.includes('job offer') && combined.includes('congratulations'))
    ) {
      return {
        category: 'OFFER_RECEIVED',
        confidence: 0.96,
        suggestedStatus: 'OFFERED',
      };
    }

    // 2. Interview Invitation
    if (
      combined.includes('interview invitation') ||
      combined.includes('invitation to interview') ||
      combined.includes('schedule an interview') ||
      combined.includes('schedule your interview') ||
      combined.includes('screening call') ||
      combined.includes('technical assessment') ||
      combined.includes('coding challenge') ||
      combined.includes('next round of interviews')
    ) {
      return {
        category: 'INTERVIEW_INVITATION',
        confidence: 0.94,
        suggestedStatus: 'INTERVIEWING',
      };
    }

    // 3. Rejection
    if (
      combined.includes('not moving forward') ||
      combined.includes('unfortunately') ||
      combined.includes('other candidates') ||
      combined.includes('pursue other applicants') ||
      combined.includes('regret to inform') ||
      combined.includes('decided not to proceed')
    ) {
      return {
        category: 'REJECTION',
        confidence: 0.92,
        suggestedStatus: 'REJECTED',
      };
    }

    // 4. Application Acknowledged
    if (
      combined.includes('thank you for applying') ||
      combined.includes('application received') ||
      combined.includes('we received your application') ||
      combined.includes('application confirmation') ||
      combined.includes('successfully submitted your application')
    ) {
      return {
        category: 'APPLICATION_ACKNOWLEDGED',
        confidence: 0.90,
        suggestedStatus: 'SUBMITTED',
      };
    }

    // 5. General Update
    return {
      category: 'GENERAL_UPDATE',
      confidence: 0.60,
      suggestedStatus: null,
    };
  }

  /**
   * Ingests, classifies, correlates with active application, and optionally auto-updates status.
   */
  static async processInboundEmail(
    userId: string,
    input: ClassifyInboundEmailInput,
    autoApplyOverride?: boolean
  ): Promise<InboundEmailEventDTO> {
    const classification = this.classifyText(input.subject, input.snippet);

    // Correlate with candidate's existing applications
    const applications = await prisma.application.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { createdAt: 'desc' },
    });

    const senderDomain = input.senderEmail.split('@')[1]?.toLowerCase() || '';
    const textLower = `${input.subject} ${input.snippet} ${input.senderName || ''}`.toLowerCase();

    const matchedApp = applications.find((app) => {
      const company = app.job.company.toLowerCase();
      return (
        senderDomain.includes(company) ||
        textLower.includes(company) ||
        (app.job.applyUrl && app.job.applyUrl.toLowerCase().includes(senderDomain))
      );
    });

    const autoApply = autoApplyOverride ?? false;
    let actionTaken: string | null = null;
    let autoApplied = false;

    // Auto-apply state change if requested and confidence is high
    if (autoApply && matchedApp && classification.suggestedStatus && classification.confidence >= 0.85) {
      try {
        if (classification.suggestedStatus === 'SUBMITTED' && matchedApp.workflowStatus !== 'SUBMITTED') {
          await ApplicationStateMachine.transition({
            applicationId: matchedApp.id,
            toStatus: 'SUBMITTED',
            toStage: 'APPLIED',
            actorType: 'AGENT',
            title: 'Auto-Updated: Application Acknowledged by Employer',
            description: `Confirmed via email from ${input.senderEmail}. Subject: "${input.subject}"`,
          });
          actionTaken = 'Auto-transitioned application to SUBMITTED';
          autoApplied = true;
        } else if (classification.suggestedStatus === 'INTERVIEWING') {
          await prisma.application.update({
            where: { id: matchedApp.id },
            data: { stage: 'INTERVIEWING', lastActivityAt: new Date() },
          });
          await prisma.applicationEvent.create({
            data: {
              applicationId: matchedApp.id,
              eventType: 'INTERVIEW_INVITATION_RECEIVED',
              fromStatus: matchedApp.workflowStatus,
              toStatus: matchedApp.workflowStatus,
              actorType: 'AGENT',
              title: 'Interview Invitation Detected',
              description: `Inbound email from ${input.senderEmail}: "${input.subject}"`,
            },
          });
          actionTaken = 'Updated application stage to INTERVIEWING';
          autoApplied = true;
        } else if (classification.suggestedStatus === 'REJECTED') {
          await prisma.application.update({
            where: { id: matchedApp.id },
            data: { stage: 'REJECTED', lastActivityAt: new Date() },
          });
          await prisma.applicationEvent.create({
            data: {
              applicationId: matchedApp.id,
              eventType: 'APPLICATION_REJECTED',
              fromStatus: matchedApp.workflowStatus,
              toStatus: matchedApp.workflowStatus,
              actorType: 'AGENT',
              title: 'Rejection Email Detected',
              description: `Inbound email from ${input.senderEmail}: "${input.subject}"`,
            },
          });
          actionTaken = 'Updated application stage to REJECTED';
          autoApplied = true;
        }
      } catch (err: any) {
        actionTaken = `Auto-apply failed: ${err.message}`;
      }
    }

    const event = await prisma.inboundEmailEvent.upsert({
      where: {
        userId_messageId: {
          userId,
          messageId: input.messageId,
        },
      },
      update: {
        classifiedCategory: classification.category,
        confidence: classification.confidence,
        suggestedStatus: classification.suggestedStatus,
        autoApplied,
        actionTaken,
      },
      create: {
        userId,
        applicationId: matchedApp ? matchedApp.id : null,
        provider: input.provider,
        messageId: input.messageId,
        senderEmail: input.senderEmail,
        senderName: input.senderName || null,
        recipientEmail: input.recipientEmail,
        subject: input.subject,
        snippet: input.snippet,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        classifiedCategory: classification.category,
        confidence: classification.confidence,
        suggestedStatus: classification.suggestedStatus,
        autoApplied,
        actionTaken,
      },
      include: {
        application: { include: { job: true } },
      },
    });

    return this.mapToDTO(event);
  }

  /**
   * User manually confirms or applies the suggested status transition.
   */
  static async resolveEvent(
    userId: string,
    eventId: string,
    input: ResolveInboundEmailInput
  ): Promise<InboundEmailEventDTO> {
    const event = await prisma.inboundEmailEvent.findUnique({
      where: { id: eventId },
      include: { application: { include: { job: true } } },
    });

    if (!event || event.userId !== userId) {
      throw new Error('Inbound email event not found');
    }

    let actionTaken = 'Resolved without status change';
    if (input.applySuggestedStatus && event.application && event.suggestedStatus) {
      const app = event.application;
      if (event.suggestedStatus === 'SUBMITTED' && app.workflowStatus !== 'SUBMITTED') {
        await ApplicationStateMachine.transition({
          applicationId: app.id,
          toStatus: 'SUBMITTED',
          toStage: 'APPLIED',
          actorType: 'USER',
          title: 'Manual Status Update: Application Confirmed via Email',
          description: `Applied via email: ${event.subject}`,
        });
        actionTaken = 'Applied SUBMITTED status to application';
      } else if (event.suggestedStatus === 'INTERVIEWING') {
        await prisma.application.update({
          where: { id: app.id },
          data: { stage: 'INTERVIEWING', lastActivityAt: new Date() },
        });
        actionTaken = 'Moved application to INTERVIEWING stage';
      } else if (event.suggestedStatus === 'REJECTED') {
        await prisma.application.update({
          where: { id: app.id },
          data: { stage: 'REJECTED', lastActivityAt: new Date() },
        });
        actionTaken = 'Moved application to REJECTED stage';
      }
    }

    const updated = await prisma.inboundEmailEvent.update({
      where: { id: eventId },
      data: {
        isResolved: true,
        actionTaken,
      },
      include: {
        application: { include: { job: true } },
      },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Lists classified inbound emails.
   */
  static async listEvents(userId: string): Promise<InboundEmailEventDTO[]> {
    const events = await prisma.inboundEmailEvent.findMany({
      where: { userId },
      include: { application: { include: { job: true } } },
      orderBy: { receivedAt: 'desc' },
    });

    return events.map((e) => this.mapToDTO(e));
  }

  private static mapToDTO(e: any): InboundEmailEventDTO {
    return {
      id: e.id,
      userId: e.userId,
      applicationId: e.applicationId,
      company: e.application?.job?.company || null,
      provider: e.provider,
      messageId: e.messageId,
      senderEmail: e.senderEmail,
      senderName: e.senderName,
      recipientEmail: e.recipientEmail,
      subject: e.subject,
      snippet: e.snippet,
      receivedAt: e.receivedAt.toISOString(),
      classifiedCategory: e.classifiedCategory as EmailClassificationCategory,
      confidence: e.confidence,
      suggestedStatus: e.suggestedStatus,
      autoApplied: e.autoApplied,
      isResolved: e.isResolved,
      actionTaken: e.actionTaken,
      createdAt: e.createdAt.toISOString(),
    };
  }
}
