import { z } from 'zod';

/**
 * Enums shared by api / web / worker.
 * The Prisma enums in `packages/db/prisma/schema.prisma` must stay in sync.
 */

/** Roles per spec §4 (Authorisation). */
export const UserRoleEnum = z.enum([
  'SUPER_ADMIN',
  'ORG_OWNER',
  'ORG_ADMIN',
  'MENTOR',
  'CANDIDATE',
]);
export type UserRole = z.infer<typeof UserRoleEnum>;

/** Organization types per spec §4. */
export const OrgTypeEnum = z.enum(['COLLEGE', 'COACHING', 'COMPANY', 'OTHER']);
export type OrgType = z.infer<typeof OrgTypeEnum>;

/**
 * OTP purposes per spec §5 — codes are never interchangeable.
 */
export const OtpPurposeEnum = z.enum([
  'VERIFY_EMAIL',
  'LOGIN',
  'RESET_PASSWORD',
  'CHANGE_EMAIL',
  'SENSITIVE_ACTION',
]);
export type OtpPurpose = z.infer<typeof OtpPurposeEnum>;

/** How a user authenticated in a given session. */
export const AuthMethodEnum = z.enum(['PASSWORD', 'OTP', 'TOTP', 'REFRESH']);
export type AuthMethod = z.infer<typeof AuthMethodEnum>;

/** Security events recorded in `AuthEvent` (spec §5 "audit login"). */
export const AuthEventEnum = z.enum([
  'REGISTER',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'OTP_SENT',
  'OTP_VERIFIED',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_LIMIT_EXCEEDED',
  'ACCOUNT_LOCKED',
  'LOGOUT',
  'LOGOUT_ALL',
  'REFRESH_ROTATED',
  'REFRESH_REUSE_DETECTED',
  'SESSION_REVOKED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED',
  'EMAIL_CHANGE_REQUESTED',
  'EMAIL_CHANGED',
  '2FA_ENROLLED',
  '2FA_DISABLED',
]);
export type AuthEvent = z.infer<typeof AuthEventEnum>;

/** Source of a candidate fact (spec §6, §7). */
export const FactSourceEnum = z.enum([
  'RESUME_UPLOAD',
  'USER_INPUT',
  'AGENT_SUGGESTION',
  'ORG_IMPORT',
]);
export type FactSource = z.infer<typeof FactSourceEnum>;

/** Verdict shown next to every profile fact (spec §6, §7, §18). */
export const VerificationStatusEnum = z.enum([
  'UNVERIFIED',
  'USER_VERIFIED',
  'SUPERSEDED',
]);
export type VerificationStatus = z.infer<typeof VerificationStatusEnum>;

/** Candidate automation modes (spec §7). */
export const AutomationModeEnum = z.enum([
  'STRICT_APPROVAL',
  'BATCH_REVIEW',
  'FULL_AUTO',
]);
export type AutomationMode = z.infer<typeof AutomationModeEnum>;

/** Canonical question categories (spec §6). */
export const QuestionCategoryEnum = z.enum([
  'IDENTITY',
  'WORK_AUTH',
  'LOCATION',
  'COMPENSATION',
  'AVAILABILITY',
  'EXPERIENCE',
  'EDUCATION',
  'MOTIVATION',
  'LEGAL',
  'EEO',
]);
export type QuestionCategory = z.infer<typeof QuestionCategoryEnum>;

/** Question sensitivity levels (spec §6). */
export const QuestionSensitivityEnum = z.enum([
  'PUBLIC',
  'CONFIDENTIAL',
  'HIGHLY_SENSITIVE',
]);
export type QuestionSensitivity = z.infer<typeof QuestionSensitivityEnum>;

/** Scope for answers (spec §6). */
export const AnswerScopeEnum = z.enum([
  'GLOBAL',
  'PER_COUNTRY',
  'PER_COMPANY',
  'PER_ROLE_TYPE',
]);
export type AnswerScope = z.infer<typeof AnswerScopeEnum>;

/** Job discovery source providers per spec §9. */
export const JobSourceProviderEnum = z.enum([
  'REMOTIVE',
  'GREENHOUSE',
  'LEVER',
  'ADZUNA',
  'ASHBY',
  'USER_PASTED',
  'ORG_POSTED',
  'CUSTOM',
]);
export type JobSourceProvider = z.infer<typeof JobSourceProviderEnum>;

/** Job posting status per spec §9 ("Freshness"). */
export const JobPostingStatusEnum = z.enum([
  'OPEN',
  'STALE',
  'CLOSED',
  'UNKNOWN',
]);
export type JobPostingStatus = z.infer<typeof JobPostingStatusEnum>;

/** Workplace arrangement types. */
export const JobRemoteTypeEnum = z.enum(['REMOTE', 'HYBRID', 'ONSITE']);
export type JobRemoteType = z.infer<typeof JobRemoteTypeEnum>;

/** Seniority levels for jobs. */
export const JobSeniorityEnum = z.enum([
  'INTERN',
  'ENTRY',
  'MID',
  'SENIOR',
  'LEAD',
  'EXECUTIVE',
]);
export type JobSeniority = z.infer<typeof JobSeniorityEnum>;

/** Saved search run frequency per plan frequency. */
export const SearchFrequencyEnum = z.enum(['REALTIME', 'DAILY', 'WEEKLY']);
export type SearchFrequency = z.infer<typeof SearchFrequencyEnum>;

/** Application pipeline tracking stages per spec §14. */
export const ApplicationStageEnum = z.enum([
  'SAVED',
  'PREPARING',
  'APPLIED',
  'SCREENING',
  'INTERVIEWING',
  'OFFERED',
  'REJECTED',
  'WITHDRAWN',
  'NO_RESPONSE',
]);
export type ApplicationStage = z.infer<typeof ApplicationStageEnum>;

/** Application execution state machine status per spec §13. */
export const WorkflowStatusEnum = z.enum([
  'SAVED',
  'QUEUED',
  'JOB_VALIDATED',
  'PROFILE_MATCHED',
  'APPLICATION_PREPARED',
  'WAITING_FOR_USER',
  'AWAITING_APPROVAL',
  'READY_TO_SUBMIT',
  'SUBMITTING',
  'SUBMITTED',
  'SUBMISSION_UNCERTAIN',
  'FAILED',
  'NEEDS_INTERVENTION',
  'CANCELLED',
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusEnum>;

/** Execution modes per spec §13. */
export const ExecutionModeEnum = z.enum([
  'PREPARE_ONLY',
  'APPROVAL_REQUIRED',
  'AUTO_APPLY',
]);
export type ExecutionMode = z.infer<typeof ExecutionModeEnum>;

/** Application submission channels per spec §13. */
export const SubmissionChannelEnum = z.enum([
  'OFFICIAL_API',
  'ASSISTED_EXTENSION',
  'PLAYWRIGHT_AUTO',
  'EMAIL',
  'MANUAL_FALLBACK',
]);
export type SubmissionChannel = z.infer<typeof SubmissionChannelEnum>;

/** Missing information request status per spec §15. */
export const MissingInfoStatusEnum = z.enum(['PENDING', 'ANSWERED', 'SKIPPED']);
export type MissingInfoStatus = z.infer<typeof MissingInfoStatusEnum>;

/** Billing Plan Tiers per spec §19. */
export const PlanTierEnum = z.enum(['INDIVIDUAL', 'ORGANIZATION']);
export type PlanTier = z.infer<typeof PlanTierEnum>;

/** Billing Intervals per spec §19. */
export const BillingIntervalEnum = z.enum(['MONTHLY', 'ANNUAL', 'ONE_TIME']);
export type BillingInterval = z.infer<typeof BillingIntervalEnum>;

/** Supported payment providers per spec §19. */
export const PaymentProviderTypeEnum = z.enum(['RAZORPAY', 'STRIPE', 'FREE_DEV', 'OFFLINE_PO']);
export type PaymentProviderType = z.infer<typeof PaymentProviderTypeEnum>;

/** Subscription statuses per spec §19. */
export const SubscriptionStatusEnum = z.enum([
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'TRIALING',
  'UNPAID',
  'EXPIRED',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusEnum>;

/** Invoice statuses per spec §19. */
export const InvoiceStatusEnum = z.enum(['DRAFT', 'PAID', 'VOID', 'UNCOLLECTIBLE']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum>;

/** Webhook process statuses. */
export const WebhookProcessStatusEnum = z.enum(['SUCCESS', 'DUPLICATE', 'FAILED']);
export type WebhookProcessStatus = z.infer<typeof WebhookProcessStatusEnum>;


