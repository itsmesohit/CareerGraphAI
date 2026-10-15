import { prisma, graphOps } from '@careergraph/db';
import { matchingService } from '../matching/matchingService.js';
import { OrchestratorService } from './orchestratorService.js';
import type { AnswerScope } from '@careergraph/shared';

export class MissingInfoService {
  /**
   * Retrieves pending missing information items for a user.
   */
  static async listMissingItems(userId: string) {
    const items = await prisma.missingInfoRequest.findMany({
      where: {
        userId,
        status: 'PENDING',
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
          },
        },
        application: {
          select: {
            id: true,
            stage: true,
            workflowStatus: true,
            matchScore: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => ({
      id: item.id,
      userId: item.userId,
      applicationId: item.applicationId,
      jobId: item.jobId,
      companyName: item.job.company,
      jobTitle: item.job.title,
      questionKey: item.questionKey,
      questionText: item.questionText,
      category: item.category,
      reason: item.reason,
      suggestedAnswer: item.suggestedAnswer,
      candidateAnswer: item.candidateAnswer,
      answerScope: item.answerScope,
      status: item.status,
      resolvedAt: item.resolvedAt?.toISOString() || null,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  /**
   * Resolves a missing question, saves to universal question bank and graph memory,
   * updates the application, and resumes workflow if unblocked.
   */
  static async resolveMissingItem(
    userId: string,
    itemId: string,
    candidateAnswer: string,
    answerScope: AnswerScope = 'GLOBAL'
  ) {
    const item = await prisma.missingInfoRequest.findUnique({
      where: { id: itemId },
      include: {
        application: true,
        job: true,
      },
    });

    if (!item || item.userId !== userId) {
      throw new Error('Missing information item not found');
    }

    // 1. Update the missing info request record
    const updatedItem = await prisma.missingInfoRequest.update({
      where: { id: itemId },
      data: {
        candidateAnswer,
        answerScope,
        status: 'ANSWERED',
        resolvedAt: new Date(),
      },
    });

    // 2. Persist to CandidateAnswer and CanonicalQuestion
    let question = await prisma.canonicalQuestion.findUnique({
      where: { key: item.questionKey },
    });

    if (!question) {
      question = await prisma.canonicalQuestion.create({
        data: {
          key: item.questionKey,
          category: (item.category as any) || 'EXPERIENCE',
          questionText: item.questionText,
          answerType: 'text',
          sensitivity: 'CONFIDENTIAL',
        },
      });
    }

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (profile) {
      const existingAnswer = await prisma.candidateAnswer.findFirst({
        where: {
          profileId: profile.id,
          questionKey: question.key,
        },
      });

      if (existingAnswer) {
        await prisma.candidateAnswer.update({
          where: { id: existingAnswer.id },
          data: {
            value: candidateAnswer,
            scope: answerScope,
            verificationStatus: 'USER_VERIFIED',
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.candidateAnswer.create({
          data: {
            profileId: profile.id,
            questionKey: question.key,
            value: candidateAnswer,
            scope: answerScope,
            verificationStatus: 'USER_VERIFIED',
          },
        });
      }
    }

    // 3. Project to FalkorDB Semantic Memory
    await graphOps.recordSemanticMemory(userId, {
      category: 'SEMANTIC',
      text: `Candidate supplied answer for "${item.questionText}": "${candidateAnswer}"`,
      context: `MissingInfo_${item.job.company}_${item.questionKey}`,
      verified: true,
    });

    // 4. Update Application prepared answers map
    const app = await prisma.application.findUnique({
      where: { id: item.applicationId },
      include: { job: true },
    });

    if (!app) throw new Error('Application not found');

    const prepared = (app.preparedAnswers as Record<string, any>) || {};
    prepared[item.questionKey] = {
      questionKey: item.questionKey,
      question: item.questionText,
      answer: candidateAnswer,
      confidence: 1.0,
      source: 'USER_RESOLVED_MISSING_INFO',
    };

    await prisma.application.update({
      where: { id: app.id },
      data: {
        preparedAnswers: prepared,
        lastActivityAt: new Date(),
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId: app.id,
        eventType: 'MISSING_INFO_RESOLVED',
        actorType: 'USER',
        actorId: userId,
        title: `Question Resolved: ${item.questionText.slice(0, 40)}...`,
        description: `Candidate provided answer with scope ${answerScope}: "${candidateAnswer}"`,
      },
    });

    // 5. Check if other items remain pending for this application
    const remainingPending = await prisma.missingInfoRequest.count({
      where: {
        applicationId: app.id,
        status: 'PENDING',
      },
    });

    if (remainingPending === 0) {
      // Re-evaluate match and finalize preparation
      const profile = await prisma.candidateProfile.findUnique({
        where: { userId },
        include: {
          experiences: true,
          educations: true,
          skills: true,
          projects: true,
          preferences: true,
        },
      });

      const match = await matchingService.evaluateMatch(userId, app.jobId);

      await OrchestratorService.finalizePreparation(
        app.id,
        profile,
        app.job,
        match,
        prepared
      );
    }

    return updatedItem;
  }

  /**
   * Skips an optional missing item.
   */
  static async skipMissingItem(userId: string, itemId: string) {
    const item = await prisma.missingInfoRequest.findUnique({
      where: { id: itemId },
    });

    if (!item || item.userId !== userId) {
      throw new Error('Missing information item not found');
    }

    return prisma.missingInfoRequest.update({
      where: { id: itemId },
      data: {
        status: 'SKIPPED',
        resolvedAt: new Date(),
      },
    });
  }
}
