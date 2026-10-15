import { z } from 'zod';
import { OrgTypeEnum, UserRoleEnum, AutomationModeEnum } from './enums.js';

export const OrganizationDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: OrgTypeEnum,
  logoUrl: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  primaryColor: z.string().default('#0284c7'),
  seatsPurchased: z.number().int().default(50),
  seatsUsed: z.number().int().default(0),
  defaultAutomationMode: AutomationModeEnum.default('STRICT_APPROVAL'),
  maxDailyApplications: z.number().int().default(25),
  requireMentorReview: z.boolean().default(false),
  allowedCompanies: z.array(z.string()).nullable().optional(),
  blockedCompanies: z.array(z.string()).nullable().optional(),
  createdAt: z.string(),
});
export type OrganizationDto = z.infer<typeof OrganizationDtoSchema>;

export const CreateOrganizationInputSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  type: OrgTypeEnum.default('COLLEGE'),
  domain: z.string().optional().nullable(),
  primaryColor: z.string().optional().default('#0284c7'),
  seatsPurchased: z.number().int().positive().optional().default(50),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInputSchema>;

export const UpdateOrganizationPolicyInputSchema = z.object({
  defaultAutomationMode: AutomationModeEnum.optional(),
  maxDailyApplications: z.number().int().min(1).max(200).optional(),
  requireMentorReview: z.boolean().optional(),
  allowedCompanies: z.array(z.string()).optional(),
  blockedCompanies: z.array(z.string()).optional(),
});
export type UpdateOrganizationPolicyInput = z.infer<typeof UpdateOrganizationPolicyInputSchema>;

export const CohortDtoSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  department: z.string().nullable().optional(),
  gradYear: z.number().int().nullable().optional(),
  description: z.string().nullable().optional(),
  memberCount: z.number().int().default(0),
  createdAt: z.string(),
});
export type CohortDto = z.infer<typeof CohortDtoSchema>;

export const CreateCohortInputSchema = z.object({
  name: z.string().min(2, 'Cohort name is required'),
  department: z.string().optional().nullable(),
  gradYear: z.number().int().min(2000).max(2100).optional().nullable(),
  description: z.string().optional().nullable(),
});
export type CreateCohortInput = z.infer<typeof CreateCohortInputSchema>;

export const StudentConsentDtoSchema = z.object({
  orgId: z.string(),
  userId: z.string(),
  shareProfile: z.boolean(),
  shareApplications: z.boolean(),
  shareResumes: z.boolean(),
  shareOffers: z.boolean(),
  allowMentorReview: z.boolean(),
  updatedAt: z.string(),
});
export type StudentConsentDto = z.infer<typeof StudentConsentDtoSchema>;

export const UpdateStudentConsentInputSchema = z.object({
  shareProfile: z.boolean().optional(),
  shareApplications: z.boolean().optional(),
  shareResumes: z.boolean().optional(),
  shareOffers: z.boolean().optional(),
  allowMentorReview: z.boolean().optional(),
});
export type UpdateStudentConsentInput = z.infer<typeof UpdateStudentConsentInputSchema>;

export const OrgInvitationDtoSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  cohortId: z.string().nullable().optional(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: UserRoleEnum,
  token: z.string(),
  status: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type OrgInvitationDto = z.infer<typeof OrgInvitationDtoSchema>;

export const BulkCsvInvitationInputSchema = z.object({
  csvContent: z.string().min(5, 'CSV content cannot be empty'),
  cohortId: z.string().optional().nullable(),
  role: UserRoleEnum.optional().default('CANDIDATE'),
  dryRun: z.boolean().optional().default(false),
});
export type BulkCsvInvitationInput = z.infer<typeof BulkCsvInvitationInputSchema>;

export const BulkCsvReportDtoSchema = z.object({
  totalRows: z.number().int(),
  validCount: z.number().int(),
  invalidCount: z.number().int(),
  createdInvitations: z.array(OrgInvitationDtoSchema),
  errors: z.array(
    z.object({
      row: z.number().int(),
      email: z.string().optional(),
      reason: z.string(),
    })
  ),
});
export type BulkCsvReportDto = z.infer<typeof BulkCsvReportDtoSchema>;

export const CampusDriveDtoSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  title: z.string(),
  companyName: z.string(),
  description: z.string(),
  roleType: z.string(),
  location: z.string().nullable().optional(),
  ctcMin: z.number().int().nullable().optional(),
  ctcMax: z.number().int().nullable().optional(),
  currency: z.string().default('INR'),
  deadline: z.string().nullable().optional(),
  targetCohortIds: z.array(z.string()),
  minCgpa: z.number().nullable().optional(),
  status: z.string(),
  applicationsCount: z.number().int().default(0),
  createdAt: z.string(),
});
export type CampusDriveDto = z.infer<typeof CampusDriveDtoSchema>;

export const CreateCampusDriveInputSchema = z.object({
  title: z.string().min(2, 'Drive title is required'),
  companyName: z.string().min(2, 'Company name is required'),
  description: z.string().min(10, 'Drive description must be at least 10 characters'),
  roleType: z.string().default('Full-Time'),
  location: z.string().optional().nullable(),
  ctcMin: z.number().int().nonnegative().optional().nullable(),
  ctcMax: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().default('INR'),
  deadline: z.string().optional().nullable(),
  targetCohortIds: z.array(z.string()).default([]),
  minCgpa: z.number().min(0).max(10).optional().nullable(),
  eligibleDepartments: z.array(z.string()).optional(),
});
export type CreateCampusDriveInput = z.infer<typeof CreateCampusDriveInputSchema>;

export const CohortAnalyticsDtoSchema = z.object({
  cohortId: z.string(),
  cohortName: z.string(),
  totalStudents: z.number().int(),
  activeStudents: z.number().int(),
  placedStudents: z.number().int(),
  placementRate: z.number().min(0).max(100),
  totalApplications: z.number().int(),
  interviewsScheduled: z.number().int(),
  offersReceived: z.number().int(),
  medianOfferedCtc: z.number().int(),
  topCompanies: z.array(
    z.object({
      company: z.string(),
      count: z.number().int(),
    })
  ),
  skillGaps: z.array(
    z.object({
      skill: z.string(),
      studentCount: z.number().int(),
      demandScore: z.number(),
    })
  ),
  atRiskStudents: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      email: z.string(),
      reason: z.string(),
      completeness: z.number(),
    })
  ),
});
export type CohortAnalyticsDto = z.infer<typeof CohortAnalyticsDtoSchema>;
