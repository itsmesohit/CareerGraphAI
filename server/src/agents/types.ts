export type ApplicationStatus =
  | 'RECEIVED'
  | 'JOB_VALIDATED'
  | 'PROFILE_MATCHED'
  | 'APPLICATION_PREPARED'
  | 'WAITING_FOR_USER'
  | 'AWAITING_APPROVAL'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'FAILED'
  | 'NEEDS_INTERVENTION';

export type ExecutionMode = 'PREPARE_ONLY' | 'APPROVAL_REQUIRED' | 'AUTO_APPLY';

export interface MissingInformationItem {
  id: string;
  applicationId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  questionKey: string;
  questionText: string;
  reason: string;
  suggestedAnswer?: string;
  candidateAnswer?: string;
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
}

export interface ApplicationRecord {
  id: string;
  tenantId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  location: string;
  status: ApplicationStatus;
  mode: ExecutionMode;
  matchScore: number;
  preparedAnswers: Record<string, string>;
  coverLetterText?: string;
  missingItems: MissingInformationItem[];
  approvalRequestedAt?: string;
  approvedAt?: string;
  submittedAt?: string;
  submissionConfirmationId?: string;
  createdAt: string;
  updatedAt: string;
  decisionExplanation?: string;
}

export interface RecruiterOutreachDraft {
  id: string;
  tenantId: string;
  jobId: string;
  company: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  approved: boolean;
  approvedAt?: string;
  sent: boolean;
  sentAt?: string;
  createdAt: string;
}
