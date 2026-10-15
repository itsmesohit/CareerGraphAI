import { z } from 'zod';
import { UserRoleEnum, OrgTypeEnum } from './enums.js';

export const AdminPlatformStatsDtoSchema = z.object({
  totalUsers: z.number().int(),
  candidatesCount: z.number().int(),
  mentorsCount: z.number().int(),
  orgAdminsCount: z.number().int(),
  superAdminsCount: z.number().int(),
  totalOrganizations: z.number().int(),
  totalApplications: z.number().int(),
  totalJobs: z.number().int(),
  totalInvoices: z.number().int(),
  totalRevenueINR: z.number(),
  activeSessionsCount: z.number().int(),
});
export type AdminPlatformStatsDto = z.infer<typeof AdminPlatformStatsDtoSchema>;

export const AdminUserSummaryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: UserRoleEnum,
  isEmailVerified: z.boolean(),
  isSuspended: z.boolean(),
  suspendedReason: z.string().nullable().optional(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable().optional(),
  organizations: z.array(z.string()).default([]),
});
export type AdminUserSummaryDto = z.infer<typeof AdminUserSummaryDtoSchema>;

export const UpdateUserRoleInputSchema = z.object({
  role: UserRoleEnum,
});
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleInputSchema>;

export const SuspendUserInputSchema = z.object({
  isSuspended: z.boolean(),
  reason: z.string().optional().nullable(),
});
export type SuspendUserInput = z.infer<typeof SuspendUserInputSchema>;

export const AdminOrgSummaryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: OrgTypeEnum,
  seatsPurchased: z.number().int(),
  seatsUsed: z.number().int(),
  membersCount: z.number().int(),
  createdAt: z.string(),
});
export type AdminOrgSummaryDto = z.infer<typeof AdminOrgSummaryDtoSchema>;

export const UpdateOrgSeatsInputSchema = z.object({
  seatsPurchased: z.number().int().min(1, 'Seats must be at least 1'),
});
export type UpdateOrgSeatsInput = z.infer<typeof UpdateOrgSeatsInputSchema>;

export const AuditLogEntryDtoSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  orgId: z.string().nullable().optional(),
  action: z.string(),
  resource: z.string(),
  metadata: z.any().optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type AuditLogEntryDto = z.infer<typeof AuditLogEntryDtoSchema>;

export const AuditLogQueryInputSchema = z.object({
  action: z.string().optional(),
  userId: z.string().optional(),
  actorId: z.string().optional(),
  resource: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});
export type AuditLogQueryInput = z.infer<typeof AuditLogQueryInputSchema>;

export const AuditLogResponseDtoSchema = z.object({
  logs: z.array(AuditLogEntryDtoSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type AuditLogResponseDto = z.infer<typeof AuditLogResponseDtoSchema>;

export const DataExportArchiveDtoSchema = z.object({
  exportedAt: z.string(),
  complianceStandard: z.string().default('DPDP_ACT_2023_AND_GDPR_ART_20'),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    createdAt: z.string(),
  }),
  profile: z.any().nullable().optional(),
  experiences: z.array(z.any()).default([]),
  educations: z.array(z.any()).default([]),
  skills: z.array(z.any()).default([]),
  projects: z.array(z.any()).default([]),
  canonicalAnswers: z.array(z.any()).default([]),
  applications: z.array(z.any()).default([]),
  outreachDrafts: z.array(z.any()).default([]),
  interviews: z.array(z.any()).default([]),
  consents: z.array(z.any()).default([]),
  graphFacts: z.array(z.any()).default([]),
  invoices: z.array(z.any()).default([]),
});
export type DataExportArchiveDto = z.infer<typeof DataExportArchiveDtoSchema>;

export const AccountErasureInputSchema = z.object({
  confirmationPhrase: z.literal('DELETE MY ACCOUNT PERMANENTLY'),
  password: z.string().optional(),
  feedback: z.string().optional(),
});
export type AccountErasureInput = z.infer<typeof AccountErasureInputSchema>;

export const AccountErasureResponseDtoSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  purgedAt: z.string(),
});
export type AccountErasureResponseDto = z.infer<typeof AccountErasureResponseDtoSchema>;

export const SanitizePromptResultDtoSchema = z.object({
  sanitized: z.string(),
  isFlagged: z.boolean(),
  matchedPatterns: z.array(z.string()),
});
export type SanitizePromptResultDto = z.infer<typeof SanitizePromptResultDtoSchema>;
