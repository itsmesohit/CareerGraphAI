/**
 * Cross-package constants. Anything that changes behaviour on both sides of the
 * wire (cookie names, rate-limit buckets, limits) lives here so the API and the
 * web app cannot drift.
 */

/** Refresh-token cookie. httpOnly, so only the API reads it. */
export const REFRESH_COOKIE_NAME = 'cg_refresh';
/** CSRF cookie: readable by JS on purpose (double-submit pattern). */
export const CSRF_COOKIE_NAME = 'cg_csrf';
/** Header the SPA echoes the CSRF value in. */
export const CSRF_HEADER_NAME = 'x-csrf-token';
/** Header clients may send to override the refresh cookie (extension / tests). */
export const REFRESH_HEADER_NAME = 'x-refresh-token';

/* --- OTP policy (spec §5) ------------------------------------------------- */

/** Numeric length of a one-time code. */
export const OTP_LENGTH = 6;
export const OTP_MIN_VALUE = 100_000;
export const OTP_MAX_VALUE = 999_999;
/** A code is valid for 10 minutes. */
export const OTP_TTL_SECONDS = 10 * 60;
/** Verification attempts allowed before the code is burned. */
export const OTP_MAX_ATTEMPTS = 5;
/** Codes per (email, purpose) inside the send window. */
export const OTP_MAX_SENDS_PER_WINDOW = 3;
export const OTP_SEND_WINDOW_SECONDS = 15 * 60;
/** Wait between two sends for the same (email, purpose). */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/* --- Password / login lockout --------------------------------------------- */

/** Failed password verifications before the account is temporarily locked. */
export const LOGIN_MAX_FAILED_ATTEMPTS = 6;
/** Lock grows exponentially: base * 2^(overage-1), capped. */
export const LOGIN_LOCKOUT_BASE_SECONDS = 30;
export const LOGIN_LOCKOUT_MAX_SECONDS = 15 * 60;

/* --- Sessions / tokens ---------------------------------------------------- */

export const REFRESH_TOKEN_BYTES = 32;
export const CSRF_TOKEN_BYTES = 24;
/** How far ahead a rotation may skip a token (clock drift tolerance). */
export const ACCESS_CLOCK_SKEW_SECONDS = 10;

/* --- HTTP ----------------------------------------------------------------- */

export const MAX_JSON_BODY_BYTES = 256 * 1024;

/** Rate-limit buckets consumed by middleware. */
export const RATE_BUCKETS = {
  authIp: 'rl:auth:ip',
  authEmail: 'rl:auth:email',
  apiUser: 'rl:api:user',
  apiIp: 'rl:api:ip',
} as const;
export type RateBucket = keyof typeof RATE_BUCKETS;

/** Limits applied by the generic middleware (points per window). */
export const RATE_LIMITS: Record<RateBucket, { points: number; duration: number }> = {
  /** Any /auth endpoint, keyed by client IP. */
  authIp: { points: 30, duration: 60 },
  /** OTP sends, keyed by email (the per-email rule from spec §5). */
  authEmail: { points: 3, duration: OTP_SEND_WINDOW_SECONDS },
  /** Authenticated API traffic per user. */
  apiUser: { points: 240, duration: 60 },
  /** Authenticated API traffic per IP (defence in depth). */
  apiIp: { points: 600, duration: 60 },
};
