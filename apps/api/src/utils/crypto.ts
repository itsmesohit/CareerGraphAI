import argon2 from 'argon2';
import crypto from 'crypto';

/**
 * Hash a password using argon2id (per spec Section 5)
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Verify a plaintext password against an argon2id hash
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure 6-digit numeric OTP string
 */
export function generateNumericOtp(): string {
  // Generates integer in [100000, 999999]
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * SHA-256 hash a sensitive value (OTP or refresh token)
 * Never store plaintext OTPs or refresh tokens in the database
 */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random token string (e.g. for refresh tokens or CSRF tokens)
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}
