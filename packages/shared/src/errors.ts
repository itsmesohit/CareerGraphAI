import { z } from 'zod';

/**
 * Stable machine-readable error codes. The UI switches on these, never on the
 * human message (spec §21: "the UI and the API speak one documented contract").
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'CSRF_INVALID',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_ATTEMPTS_EXCEEDED',
  'OTP_SEND_LIMIT',
  'OTP_RESEND_COOLDOWN',
  'ACCOUNT_LOCKED',
  'PASSWORD_TOO_WEAK',
  'PASSWORD_BREACHED',
  'PASSWORD_MISSING',
  'SESSION_REVOKED',
  'REFRESH_REUSE_DETECTED',
  'TWO_FACTOR_REQUIRED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const;

export const ErrorCodeEnum = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

/** Body returned by every failing endpoint (spec §21). */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeEnum,
    message: z.string(),
    /** Field-level details for VALIDATION_ERROR. */
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** HTTP status that each code maps to — one place, used by the error handler. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  CSRF_INVALID: 403,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  OTP_INVALID: 401,
  OTP_EXPIRED: 401,
  OTP_ATTEMPTS_EXCEEDED: 429,
  OTP_SEND_LIMIT: 429,
  OTP_RESEND_COOLDOWN: 429,
  ACCOUNT_LOCKED: 423,
  PASSWORD_TOO_WEAK: 422,
  PASSWORD_BREACHED: 422,
  PASSWORD_MISSING: 422,
  SESSION_REVOKED: 401,
  REFRESH_REUSE_DETECTED: 401,
  TWO_FACTOR_REQUIRED: 401,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Application error. Services throw this; the global error handler turns it
 * into the envelope above. `expose=false` means the message may contain
 * internals and gets replaced by a generic one.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: unknown; status?: number; expose?: boolean } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? ERROR_STATUS[code];
    this.details = options.details;
    this.expose = options.expose ?? true;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Build the error envelope; safe to call with anything (e.g. an Error). */
export function toApiErrorBody(
  code: ErrorCode,
  message: string,
  requestId?: string,
  details?: unknown,
): ApiError {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      ...(requestId === undefined ? {} : { requestId }),
    },
  };
}
