import { z } from 'zod';
import {
  JobSourceProviderEnum,
  JobPostingStatusEnum,
  JobRemoteTypeEnum,
  JobSeniorityEnum,
  SearchFrequencyEnum,
  type JobSourceProvider,
  type JobPostingStatus,
  type JobRemoteType,
  type JobSeniority,
  type SearchFrequency,
} from './enums.js';

/** Capabilities reported by an adapter (Spec §9). */
export interface JobSourceCapabilities {
  supportsKeywordSearch: boolean;
  supportsCategoryFilter: boolean;
  supportsLocationFilter: boolean;
  supportsDirectApplication: boolean;
  rateLimit: string;
  attributionRequired: boolean;
  notes: string;
}

/** Search query parameters passed into JobSource.searchJobs. */
export interface JobSearchQuery {
  keywords?: string;
  category?: string;
  location?: string;
  remoteOnly?: boolean;
  limit?: number;
  page?: number;
}

/** Extracted job requirement structure. */
export interface ExtractedRequirement {
  description: string;
  skill?: string;
  isHardConstraint: boolean;
  weight: number;
  category?: string;
  minYears?: number;
}

/** Normalized job entity structure (Spec §9). */
export interface NormalizedJob {
  id: string;
  provider: JobSourceProvider;
  providerJobId?: string;
  company: string;
  title: string;
  description: string;
  jobUrl: string;
  applyUrl?: string;
  location?: string;
  country?: string;
  remoteType: JobRemoteType;
  employmentType: string;
  seniority: JobSeniority;
  minSalary?: number;
  maxSalary?: number;
  currency: string;
  skills: string[];
  qualifications: string[];
  status: JobPostingStatus;
  postedAt?: string;
  expiresAt?: string;
  attribution?: string;
  fingerprint: string;
  requirements: ExtractedRequirement[];
  rawPayload?: Record<string, any>;
}

/** Canonical JobSource adapter interface (Spec §9). */
export interface JobSource {
  readonly name: JobSourceProvider;
  getCapabilities(): JobSourceCapabilities;
  healthCheck(): Promise<boolean>;
  normalizeJob(raw: any, context?: any): NormalizedJob;
  searchJobs(query: JobSearchQuery): Promise<NormalizedJob[]>;
  getJobDetails(id: string): Promise<NormalizedJob | null>;
}

// ---------------------------------------------------------------------------
// Zod Schemas for Validation & API Endpoints
// ---------------------------------------------------------------------------

export const JobFilterQuerySchema = z.object({
  q: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  remoteType: JobRemoteTypeEnum.optional(),
  seniority: JobSeniorityEnum.optional(),
  minSalary: z.coerce.number().int().positive().optional(),
  provider: JobSourceProviderEnum.optional(),
  status: JobPostingStatusEnum.default('OPEN').optional(),
  skills: z.string().optional(), // Comma-separated
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'postedAt', 'minSalary', 'title', 'company']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type JobFilterQuery = z.infer<typeof JobFilterQuerySchema>;

export const JobUrlImportSchema = z.object({
  url: z.string().url('Must provide a valid URL'),
  company: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(20, 'Job description must be at least 20 characters').optional(),
  location: z.string().optional(),
  remoteType: JobRemoteTypeEnum.default('REMOTE').optional(),
  minSalary: z.number().int().positive().optional(),
  maxSalary: z.number().int().positive().optional(),
});
export type JobUrlImportInput = z.infer<typeof JobUrlImportSchema>;

export const SavedSearchSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  keywords: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  remoteOnly: z.boolean().default(false),
  minSalary: z.number().int().positive().optional().nullable(),
  seniority: JobSeniorityEnum.optional().nullable(),
  frequency: SearchFrequencyEnum.default('DAILY'),
  isActive: z.boolean().default(true),
});
export type SavedSearchInput = z.infer<typeof SavedSearchSchema>;
