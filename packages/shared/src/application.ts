import { z } from 'zod';
import {
  ApplicationStageEnum,
  WorkflowStatusEnum,
  ExecutionModeEnum,
  SubmissionChannelEnum,
  MissingInfoStatusEnum,
  AnswerScopeEnum,
} from './enums.js';

// ---------------------------------------------------------------------------
// Schemas for API Requests
// ---------------------------------------------------------------------------

export const CreateApplicationSchema = z.object({
  jobId: z.string().uuid(),
  mode: ExecutionModeEnum.default('APPROVAL_REQUIRED'),
  notes: z.string().optional(),
});
export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;

export const UpdateApplicationStageSchema = z.object({
  stage: ApplicationStageEnum,
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});
export type UpdateApplicationStageInput = z.infer<typeof UpdateApplicationStageSchema>;

export const ResolveMissingInfoSchema = z.object({
  candidateAnswer: z.string().min(1, 'Answer cannot be empty'),
  answerScope: AnswerScopeEnum.default('GLOBAL'),
});
export type ResolveMissingInfoInput = z.infer<typeof ResolveMissingInfoSchema>;

export const ApproveApplicationSchema = z.object({
  contentHash: z.string().min(1, 'contentHash is mandatory for secure approval'),
  submissionChannel: SubmissionChannelEnum.optional(),
  coverLetterText: z.string().optional(),
});
export type ApproveApplicationInput = z.infer<typeof ApproveApplicationSchema>;

export const BulkApproveSchema = z.object({
  approvals: z.array(
    z.object({
      applicationId: z.string().uuid(),
      contentHash: z.string().min(1),
    })
  ).min(1),
});
export type BulkApproveInput = z.infer<typeof BulkApproveSchema>;

export const AddInterviewScheduleSchema = z.object({
  roundName: z.string().min(1),
  roundType: z.enum(['HR', 'TECHNICAL', 'MANAGERIAL', 'ASSIGNMENT', 'BEHAVIORAL']).default('TECHNICAL'),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(45),
  meetingLink: z.string().url().optional().or(z.literal('')),
  interviewerNames: z.array(z.string()).default([]),
  notes: z.string().optional(),
  prepQuestions: z.array(z.string()).optional(),
});
export type AddInterviewScheduleInput = z.infer<typeof AddInterviewScheduleSchema>;

export const AddApplicationNoteSchema = z.object({
  notes: z.string().min(1),
});
export type AddApplicationNoteInput = z.infer<typeof AddApplicationNoteSchema>;

// ---------------------------------------------------------------------------
// DTOs & Domain Types
// ---------------------------------------------------------------------------

export interface PreparedAnswerItem {
  questionKey: string;
  question: string;
  answer: string;
  confidence: number;
  source: string;
  isCustomized?: boolean;
}

export interface ApplicationEventDTO {
  id: string;
  applicationId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorType: string;
  actorId?: string | null;
  title: string;
  description?: string | null;
  metadata?: any;
  createdAt: string;
}

export interface MissingInfoRequestDTO {
  id: string;
  userId: string;
  applicationId: string;
  jobId: string;
  companyName: string;
  jobTitle: string;
  questionKey: string;
  questionText: string;
  category: string;
  reason: string;
  suggestedAnswer?: string | null;
  candidateAnswer?: string | null;
  answerScope: string;
  status: 'PENDING' | 'ANSWERED' | 'SKIPPED';
  resolvedAt?: string | null;
  createdAt: string;
}

export interface InterviewScheduleDTO {
  id: string;
  applicationId: string;
  company?: string;
  jobTitle?: string;
  roundName: string;
  roundType: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingLink?: string | null;
  interviewerNames: string[];
  notes?: string | null;
  prepQuestions?: any;
  status: string;
  calendarEventId?: string | null;
  calendarProvider?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ApplicationSummaryDTO {
  id: string;
  userId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  location?: string | null;
  remoteType: string;
  applyUrl?: string | null;
  jobUrl: string;
  stage: string;
  workflowStatus: string;
  mode: string;
  matchScore: number;
  submissionChannel: string;
  contentHash?: string | null;
  pendingMissingCount: number;
  isApprovalNeeded: boolean;
  appliedAt?: string | null;
  lastActivityAt: string;
  createdAt: string;
}

export interface ApplicationDetailDTO extends ApplicationSummaryDTO {
  decisionExplanation?: string | null;
  tailoredResumeId?: string | null;
  tailoredResumeJson?: any;
  coverLetterText?: string | null;
  preparedAnswers?: Record<string, PreparedAnswerItem>;
  submissionConfirmationId?: string | null;
  submissionSnapshot?: any;
  rejectionReason?: string | null;
  notes?: string | null;
  events: ApplicationEventDTO[];
  missingItems: MissingInfoRequestDTO[];
  interviews: InterviewScheduleDTO[];
}

export interface ApplicationPacketDTO {
  applicationId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  applyUrl: string;
  contentHash: string;
  tailoredBullets: string[];
  coverLetterText: string;
  preparedAnswers: Array<{
    key: string;
    question: string;
    answer: string;
  }>;
  generatedAt: string;
}
