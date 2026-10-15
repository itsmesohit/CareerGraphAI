import { z } from 'zod';
import { WorkflowStatusEnum, SubmissionChannelEnum } from './enums.js';

// ---------------------------------------------------------------------------
// Schemas for API Requests
// ---------------------------------------------------------------------------

export const GetAutofillPayloadSchema = z.object({
  applicationId: z.string().uuid(),
  currentUrl: z.string().url().optional(),
});
export type GetAutofillPayloadInput = z.infer<typeof GetAutofillPayloadSchema>;

export const PlaywrightSubmissionSchema = z.object({
  applicationId: z.string().uuid(),
  contentHash: z.string().min(1, 'contentHash is required for submission integrity'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required for replay prevention'),
  simulatedFailure: z.enum(['NONE', 'CAPTCHA', 'MFA', 'RATE_LIMIT']).default('NONE'),
});
export type PlaywrightSubmissionInput = z.infer<typeof PlaywrightSubmissionSchema>;

export const AutomationReportResultSchema = z.object({
  applicationId: z.string().uuid(),
  status: WorkflowStatusEnum,
  channel: SubmissionChannelEnum.default('ASSISTED_EXTENSION'),
  idempotencyKey: z.string().optional(),
  confirmationId: z.string().optional(),
  confirmationUrl: z.string().url().optional().or(z.literal('')),
  interventionReason: z.string().optional(),
  learnedSelectors: z.record(z.string(), z.string()).optional(),
  screenshotBase64: z.string().optional(),
  notes: z.string().optional(),
});
export type AutomationReportResultInput = z.infer<typeof AutomationReportResultSchema>;

export const RecordProceduralMemorySchema = z.object({
  domain: z.string().min(1),
  atsType: z.enum(['GREENHOUSE', 'LEVER', 'ASHBY', 'WORKDAY', 'TALEO', 'BAMBOOHR', 'GENERIC']).default('GENERIC'),
  selectors: z.record(z.string(), z.string()),
  successRate: z.number().min(0).max(1).default(1.0),
});
export type RecordProceduralMemoryInput = z.infer<typeof RecordProceduralMemorySchema>;

// ---------------------------------------------------------------------------
// DTOs & Domain Types
// ---------------------------------------------------------------------------

export interface CandidateAutofillData {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

export interface AutofillPayloadDTO {
  applicationId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  applyUrl: string;
  contentHash: string;
  candidate: CandidateAutofillData;
  answers: Record<
    string,
    {
      question: string;
      answer: string;
      confidence: number;
      source: string;
    }
  >;
  tailoredBullets: string[];
  coverLetterText: string;
  proceduralSelectors: Record<string, string>;
  generatedAt: string;
}

export interface PlaywrightExecutionResultDTO {
  applicationId: string;
  status: 'SUBMITTED' | 'NEEDS_INTERVENTION' | 'SUBMISSION_UNCERTAIN' | 'FAILED';
  confirmationId?: string;
  confirmationUrl?: string;
  interventionReason?: string;
  channel: 'PLAYWRIGHT_AUTO';
  durationMs: number;
  fieldsFilledCount: number;
  timestamp: string;
}

export interface ProceduralMemoryDTO {
  domain: string;
  atsType: string;
  selectors: Record<string, string>;
  timesUsed: number;
  lastVerifiedAt: string;
}
