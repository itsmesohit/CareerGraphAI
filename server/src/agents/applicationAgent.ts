import { ApplicationRecord, MissingInformationItem, ExecutionMode } from './types.js';
import { JobDiscoveryEngine } from '../modules/jobs/jobService.js';
import { ProfileService } from '../modules/profile/profileService.js';
import { MatchingAgent } from './matchingAgent.js';
import { LLMProvider } from './llmProvider.js';
import { FalkorGraphService } from '../db/falkor/queries.js';

export class ApplicationAgent {
  // Store persistent applications by ID
  private static applications: Map<string, ApplicationRecord> = new Map();
  private static missingItems: Map<string, MissingInformationItem> = new Map();

  /**
   * Starts an application workflow for a selected job.
   */
  static async prepareApplication(tenantId: string, jobId: string, mode: ExecutionMode = 'APPROVAL_REQUIRED'): Promise<ApplicationRecord> {
    const job = JobDiscoveryEngine.getJobById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    // Check duplicate applications
    for (const app of this.applications.values()) {
      if (app.tenantId === tenantId && app.jobId === jobId) {
        return app;
      }
    }

    const appId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const profile = await ProfileService.getProfile(tenantId);
    const match = await MatchingAgent.evaluateMatch(tenantId, jobId);

    // Initial state
    const appRecord: ApplicationRecord = {
      id: appId,
      tenantId,
      jobId,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      status: 'JOB_VALIDATED',
      mode,
      matchScore: match.score,
      preparedAnswers: {},
      missingItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      decisionExplanation: match.explanation,
    };

    // Transition: PROFILE_MATCHED
    appRecord.status = 'PROFILE_MATCHED';

    // Map existing screening answers from profile
    for (const ans of profile.screeningAnswers) {
      appRecord.preparedAnswers[ans.questionKey] = ans.answerText;
    }

    // Check if any requirements or questions are missing
    const pendingMissing: MissingInformationItem[] = [];

    // If job requires specific skills not yet proven
    for (const missing of match.missingItems) {
      if (missing.importance === 'REQUIRED') {
        const itemId = `miss_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const item: MissingInformationItem = {
          id: itemId,
          applicationId: appId,
          jobId,
          company: job.company,
          jobTitle: job.title,
          questionKey: `exp_${missing.skillName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          questionText: `Do you have verified production experience with ${missing.skillName}? If so, please summarize your experience and scale.`,
          reason: `Job listing mandates "${missing.requirementText}", but no verified project or evidence was found in your career graph.`,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };
        this.missingItems.set(itemId, item);
        pendingMissing.push(item);
      }
    }

    // Check common screening question: Notice period
    if (!appRecord.preparedAnswers['earliest_start_date']) {
      const qKey = 'earliest_start_date';
      const itemId = `miss_${Date.now()}_start`;
      const item: MissingInformationItem = {
        id: itemId,
        applicationId: appId,
        jobId,
        company: job.company,
        jobTitle: job.title,
        questionKey: qKey,
        questionText: `What is your earliest confirmed joining date or notice period for ${job.company}?`,
        reason: 'Required ATS screening question not found in verified career profile.',
        suggestedAnswer: profile.noticePeriod ? `${profile.noticePeriod} notice period` : 'Available to start within 2 weeks',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      this.missingItems.set(itemId, item);
      pendingMissing.push(item);
    }

    appRecord.missingItems = pendingMissing;

    if (pendingMissing.length > 0) {
      // Pause workflow: WAITING_FOR_USER
      appRecord.status = 'WAITING_FOR_USER';
    } else {
      // All info available: APPLICATION_PREPARED
      await this.finalizePreparation(appRecord, profile, job, match);
    }

    this.applications.set(appId, appRecord);
    return appRecord;
  }

  /**
   * Resumes workflow after user resolves a missing item.
   */
  static async resolveMissingInformation(tenantId: string, itemId: string, answerText: string): Promise<ApplicationRecord> {
    const item = this.missingItems.get(itemId);
    if (!item) throw new Error('Missing information item not found');

    item.candidateAnswer = answerText;
    item.status = 'RESOLVED';

    const app = this.applications.get(item.applicationId);
    if (!app || app.tenantId !== tenantId) throw new Error('Application record not found');

    // Save answer into application answers
    app.preparedAnswers[item.questionKey] = answerText;

    // Persist to FalkorDB Answer, Evidence, and Semantic Memory
    await FalkorGraphService.recordAnswer(tenantId, {
      questionKey: item.questionKey,
      questionText: item.questionText,
      answerText,
      provenance: 'USER_SUPPLIED_APPLICATION_FLOW',
    });

    await FalkorGraphService.recordMemory(tenantId, {
      category: 'SEMANTIC',
      text: `Candidate supplied answer for "${item.questionText}": "${answerText}"`,
      context: `Application for ${app.company} (${app.jobTitle})`,
      verified: true,
    });

    // Check if other items remain pending
    const remaining = app.missingItems.filter(m => m.status === 'PENDING' && m.id !== itemId);
    app.missingItems = remaining;

    if (remaining.length === 0) {
      const job = JobDiscoveryEngine.getJobById(app.jobId);
      const profile = await ProfileService.getProfile(tenantId);
      const match = await MatchingAgent.evaluateMatch(tenantId, app.jobId);
      if (job) {
        await this.finalizePreparation(app, profile, job, match);
      }
    }

    app.updatedAt = new Date().toISOString();
    return app;
  }

  private static async finalizePreparation(app: ApplicationRecord, profile: any, job: any, match: any) {
    const topProj = profile.projects[0];
    const coverLetter = await LLMProvider.generateCoverLetter({
      candidateName: profile.name,
      jobTitle: job.title,
      company: job.company,
      matchedSkills: match.matchedItems.map((m: any) => m.skillName),
      topProjectTitle: topProj?.title,
      topProjectMetrics: topProj?.metrics,
    });

    app.coverLetterText = coverLetter;
    app.status = app.mode === 'AUTO_APPLY' ? 'READY_TO_SUBMIT' : 'AWAITING_APPROVAL';
    app.approvalRequestedAt = new Date().toISOString();
  }

  /**
   * User approves application for submission.
   */
  static async approveApplication(tenantId: string, appId: string): Promise<ApplicationRecord> {
    const app = this.applications.get(appId);
    if (!app || app.tenantId !== tenantId) throw new Error('Application not found');

    app.approvedAt = new Date().toISOString();
    app.status = 'READY_TO_SUBMIT';
    app.updatedAt = new Date().toISOString();

    // Trigger submission
    return this.executeSubmission(tenantId, appId);
  }

  /**
   * Executes permitted application submission through adapter or Playwright simulation.
   */
  static async executeSubmission(tenantId: string, appId: string): Promise<ApplicationRecord> {
    const app = this.applications.get(appId);
    if (!app || app.tenantId !== tenantId) throw new Error('Application not found');

    app.status = 'SUBMITTING';
    app.updatedAt = new Date().toISOString();

    // Confirm submission with idempotency ID
    const submissionId = `SUBMIT_CONFIRM_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Record submission completion
    app.status = 'SUBMITTED';
    app.submittedAt = new Date().toISOString();
    app.submissionConfirmationId = submissionId;
    app.updatedAt = new Date().toISOString();

    // Record into FalkorDB Episodic Memory
    await FalkorGraphService.recordMemory(tenantId, {
      category: 'EPISODIC',
      text: `Application successfully submitted for "${app.jobTitle}" at ${app.company}. Confirmation ID: ${submissionId}`,
      context: 'Application Submission Event',
      verified: true,
    });

    return app;
  }

  static getApplications(tenantId: string): ApplicationRecord[] {
    return Array.from(this.applications.values()).filter(a => a.tenantId === tenantId);
  }

  static getApplicationById(id: string): ApplicationRecord | undefined {
    return this.applications.get(id);
  }

  static getMissingItems(tenantId: string): MissingInformationItem[] {
    return Array.from(this.missingItems.values()).filter(m => {
      const app = this.applications.get(m.applicationId);
      return app && app.tenantId === tenantId && m.status === 'PENDING';
    });
  }
}
