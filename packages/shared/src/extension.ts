import { z } from 'zod';
import { EmailSchema, PasswordSchema } from './auth.js';
import { JobUrlImportSchema } from './job.js';

/**
 * Phase 14 — Chrome Extension contracts (Manifest V3).
 * The extension authenticates with a dedicated 7-day session token and
 * captures Schema.org/JobPosting structured data from job boards.
 */

/** POST /api/v1/extension/auth/login request */
export const ExtensionLoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
export type ExtensionLoginInput = z.infer<typeof ExtensionLoginSchema>;

/** POST /api/v1/extension/auth/login response */
export const ExtensionSessionDtoSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }),
});
export type ExtensionSessionDto = z.infer<typeof ExtensionSessionDtoSchema>;

/**
 * POST /api/v1/extension/jobs/capture request.
 * Reuses the normalized URL-import contract so captured listings flow through
 * the same dedup + requirement extraction + graph projection pipeline.
 */
export const ExtensionJobCaptureSchema = JobUrlImportSchema;
export type ExtensionJobCaptureInput = z.infer<typeof ExtensionJobCaptureSchema>;

/** POST /api/v1/extension/jobs/capture response */
export const ExtensionCaptureResponseDtoSchema = z.object({
  message: z.string(),
  isNew: z.boolean(),
  job: z.object({
    id: z.string(),
    title: z.string(),
    company: z.string(),
    jobUrl: z.string(),
    location: z.string().nullable().optional(),
  }),
});
export type ExtensionCaptureResponseDto = z.infer<typeof ExtensionCaptureResponseDtoSchema>;

/** GET /api/v1/extension/me response — popup summary card */
export const ExtensionAccountDtoSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }),
  profileCompleteness: z.number().optional(),
  applicationsCount: z.number(),
  jobsAvailable: z.number(),
  aiEnabled: z.boolean(),
});
export type ExtensionAccountDto = z.infer<typeof ExtensionAccountDtoSchema>;