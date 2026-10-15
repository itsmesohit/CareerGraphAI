import { z } from 'zod';
import { OtpPurposeEnum, UserRoleEnum } from './enums.js';

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Email input: trimmed + lower-cased. Our system of record stores the
 * normalised form so lookups are unambiguous.
 */
export const EmailSchema = z
  .string()
  .trim()
  .min(3, 'Email is required')
  .max(254, 'Email is too long')
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase());

/**
 * Password policy (spec §5: "Password strength and breach checks").
 * Length first — a long passphrase beats a symbol soup.
 */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

export const PasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Use at most ${MAX_PASSWORD_LENGTH} characters`)
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[0-9]/, 'Include at least one number');

/** Six digits — CSPRNG generated server side, typed by the user. */
export const OtpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'The code is exactly 6 digits');

export const NameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full name')
  .max(100, 'That name is too long');

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

export const RegisterRequestSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema,
  /** Marketing/updates consent toggle (spec §21: consent is explicit). */
  acceptUpdates: z.boolean().optional().default(false),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const PasswordLoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required').max(MAX_PASSWORD_LENGTH),
});
export type PasswordLoginRequest = z.infer<typeof PasswordLoginRequestSchema>;

/** Passwordless sign-in: sends a LOGIN code to an existing account. */
export const OtpLoginRequestSchema = z.object({
  email: EmailSchema,
});
export type OtpLoginRequest = z.infer<typeof OtpLoginRequestSchema>;

/**
 * Passwordless sign-in verification. The purpose is always LOGIN on this
 * endpoint, so it is intentionally NOT part of the request payload.
 * (Regression: the web client sends { email, code } only — accepting the
 * generic OtpVerifyRequestSchema here rejected every correct code with a
 * misleading "Invalid code format." 400.)
 */
export const OtpLoginVerifyRequestSchema = z.object({
  email: EmailSchema,
  code: OtpCodeSchema,
});
export type OtpLoginVerifyRequest = z.infer<typeof OtpLoginVerifyRequestSchema>;

/** Resend a code for a purpose the user is mid-flow on. */
export const OtpResendRequestSchema = z.object({
  email: EmailSchema,
  purpose: OtpPurposeEnum,
});
export type OtpResendRequest = z.infer<typeof OtpResendRequestSchema>;

export const OtpVerifyRequestSchema = z.object({
  email: EmailSchema,
  code: OtpCodeSchema,
  purpose: OtpPurposeEnum,
  /** When true, a verified LOGIN/VERIFY_EMAIL flow also issues a session. */
  createSession: z.boolean().optional().default(true),
});
export type OtpVerifyRequest = z.infer<typeof OtpVerifyRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({
  email: EmailSchema,
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  email: EmailSchema,
  code: OtpCodeSchema,
  newPassword: PasswordSchema,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  newPassword: PasswordSchema,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;


/* -------------------------------------------------------------------------- */
/* Responses                                                                   */
/* -------------------------------------------------------------------------- */

export const UserDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: UserRoleEnum,
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  onboarded: z.boolean(),
  createdAt: z.string().datetime(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

/**
 * The access token lives in memory only (spec §5). The refresh token travels in
 * an httpOnly cookie and is additionally returned here for non-browser clients
 * (integration tests, the future extension).
 */
export const AuthTokensDtoSchema = z.object({
  accessToken: z.string(),
  accessExpiresIn: z.number().int(),
  refreshToken: z.string().optional(),
});
export type AuthTokensDto = z.infer<typeof AuthTokensDtoSchema>;

export const AuthResultDtoSchema = z.object({
  user: UserDtoSchema,
  tokens: AuthTokensDtoSchema.optional(),
  /** Present when the flow is not finished yet (needs an OTP). */
  pending: z
    .object({
      purpose: OtpPurposeEnum,
      email: z.string(),
      resendAfterSeconds: z.number().int(),
      expiresInSeconds: z.number().int(),
    })
    .optional(),
});
export type AuthResultDto = z.infer<typeof AuthResultDtoSchema>;

/** Returned when a code was dispatched — never reveals whether the email exists. */
export const OtpSentDtoSchema = z.object({
  sent: z.literal(true),
  resendAfterSeconds: z.number().int(),
  expiresInSeconds: z.number().int(),
});
export type OtpSentDto = z.infer<typeof OtpSentDtoSchema>;

export const SessionDtoSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  ipAddress: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  current: z.boolean(),
  method: z.string(),
});
export type SessionDto = z.infer<typeof SessionDtoSchema>;

export const SessionListDtoSchema = z.object({
  sessions: z.array(SessionDtoSchema),
});
export type SessionListDto = z.infer<typeof SessionListDtoSchema>;

export const CsrfDtoSchema = z.object({ csrfToken: z.string() });
export type CsrfDto = z.infer<typeof CsrfDtoSchema>;

export const HealthCheckDtoSchema = z.object({
  status: z.enum(['ok', 'down', 'disabled']),
  latencyMs: z.number().optional(),
});

export const HealthDtoSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  uptimeSeconds: z.number(),
  version: z.string(),
  checks: z.record(z.string(), HealthCheckDtoSchema),
});
export type HealthDto = z.infer<typeof HealthDtoSchema>;

export const OtpVerifyResultDtoSchema = z.object({
  verified: z.literal(true),
  purpose: OtpPurposeEnum,
  user: UserDtoSchema.optional(),
  tokens: AuthTokensDtoSchema.optional(),
});
export type OtpVerifyResultDto = z.infer<typeof OtpVerifyResultDtoSchema>;

/* -------------------------------------------------------------------------- */
/* Landing page                                                                */
/* -------------------------------------------------------------------------- */

/** Honest counters from the local system of record (no invented numbers). */
export const PlatformStatsDtoSchema = z.object({
  candidates: z.number().int(),
  verifiedEmails: z.number().int(),
  activeSessions: z.number().int(),
});
export type PlatformStatsDto = z.infer<typeof PlatformStatsDtoSchema>;

// Aliases and rich landing page DTOs
export const RegisterInputSchema = RegisterRequestSchema;
export type RegisterInput = RegisterRequest;
export const VerifyOtpInputSchema = OtpVerifyRequestSchema;
export type VerifyOtpInput = OtpVerifyRequest;
export const ResendOtpInputSchema = OtpResendRequestSchema;
export type ResendOtpInput = OtpResendRequest;
export const LoginInputSchema = PasswordLoginRequestSchema;
export type LoginInput = PasswordLoginRequest;

export type UserDTO = {
  id: string;
  name: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
};

export type SessionDTO = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
};

export type PlatformStatsDTO = {
  candidatesOnboarded: number;
  applicationsSent: number;
  activeTechRoles: number;
  recruiterResponseRate: number;
  averageSecuredOffer: string;
  averageWeeksToOffer: number;
};

export type LiveActivityItemDTO = {
  id: string;
  name: string;
  role: string;
  company: string;
  score: number;
  action: string;
  timeAgo: string;
};



