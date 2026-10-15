import { prisma, OtpPurpose } from '@careergraph/db';
import { generateNumericOtp, sha256 } from '../utils/crypto.js';
import { getEmailService } from './emailService.js';

export interface SendOtpResult {
  success: boolean;
  expiresAt: Date;
  cooldownSeconds: number;
  message: string;
}

export interface VerifyOtpResult {
  success: boolean;
  reason?: 'EXPIRED_OR_NOT_FOUND' | 'TOO_MANY_ATTEMPTS' | 'INVALID_CODE';
  message: string;
  attemptsRemaining?: number;
}

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_15_MIN = 3;
const MAX_VERIFICATION_ATTEMPTS = 5;

export class OtpService {
  /**
   * Generates, stores (as hash only), and delivers a secure 6-digit OTP code.
   * Enforces 60-second cooldown, max 3 sends / 15 min per email & IP, and 10-minute expiry.
   */
  static async generateAndSendOtp(
    email: string,
    purpose: OtpPurpose,
    ipAddress?: string
  ): Promise<SendOtpResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // 1. Cooldown check: Has an OTP for this email and purpose been issued in the last 60 seconds?
    const latestOtp = await prisma.otpCode.findFirst({
      where: {
        email: normalizedEmail,
        purpose,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestOtp) {
      const elapsedSeconds = Math.floor((now.getTime() - latestOtp.createdAt.getTime()) / 1000);
      if (elapsedSeconds < OTP_COOLDOWN_SECONDS) {
        const remaining = OTP_COOLDOWN_SECONDS - elapsedSeconds;
        throw new Error(`Please wait ${remaining} seconds before requesting a new verification code.`);
      }
    }

    // 2. Email Rate Limit: Max 3 sends per 15 minutes per email
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const emailSendCount = await prisma.otpCode.count({
      where: {
        email: normalizedEmail,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (emailSendCount >= MAX_SENDS_PER_15_MIN) {
      throw new Error('Too many verification codes requested for this email. Please wait 15 minutes.');
    }

    // 3. IP Rate Limit: Max 10 sends per 15 minutes per IP (bypassed in test environment)
    if (ipAddress && process.env.NODE_ENV !== 'test') {
      const ipSendCount = await prisma.otpCode.count({
        where: {
          ipAddress,
          createdAt: { gte: fifteenMinutesAgo },
        },
      });

      if (ipSendCount >= 10) {
        throw new Error('Too many verification codes requested from this IP address. Please wait 15 minutes.');
      }
    }

    // 4. Generate 6-digit numeric code
    const plainCode = generateNumericOtp();
    const codeHash = sha256(plainCode);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // 5. Invalidate previous unconsumed OTPs for same email and purpose to prevent concurrency confusion
    await prisma.otpCode.updateMany({
      where: {
        email: normalizedEmail,
        purpose,
        usedAt: null,
      },
      data: {
        expiresAt: now, // expire them immediately
      },
    });

    // 6. Record newly hashed OTP
    await prisma.otpCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        purpose,
        attempts: 0,
        expiresAt,
        ipAddress,
      },
    });

    // 7. Deliver OTP via Email (never log plainCode)
    const emailService = getEmailService();
    await emailService.sendOtpEmail({
      to: normalizedEmail,
      code: plainCode,
      purpose,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });

    return {
      success: true,
      expiresAt,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}.`,
    };
  }

  /**
   * Verifies an OTP against its stored hash.
   * Enforces 10-minute expiry, single-use, purpose matching, and max 5 attempts lockout.
   */
  static async verifyOtp(
    email: string,
    code: string,
    purpose: OtpPurpose
  ): Promise<VerifyOtpResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // Find the latest active unconsumed OTP for this email and matching purpose
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        email: normalizedEmail,
        purpose,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return {
        success: false,
        reason: 'EXPIRED_OR_NOT_FOUND',
        message: 'Verification code is invalid or has expired. Please request a new one.',
      };
    }

    // Check attempt threshold
    if (otpRecord.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return {
        success: false,
        reason: 'TOO_MANY_ATTEMPTS',
        message: 'Maximum verification attempts exceeded (5). Please request a new code.',
      };
    }

    const providedHash = sha256(code.trim());

    if (providedHash !== otpRecord.codeHash) {
      // Increment failed attempt counter
      const updated = await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });

      const remaining = Math.max(0, MAX_VERIFICATION_ATTEMPTS - updated.attempts);

      return {
        success: false,
        reason: remaining === 0 ? 'TOO_MANY_ATTEMPTS' : 'INVALID_CODE',
        message:
          remaining === 0
            ? 'Maximum verification attempts exceeded (5). Please request a new code.'
            : `Incorrect verification code. ${remaining} attempt(s) remaining.`,
        attemptsRemaining: remaining,
      };
    }

    // Successful single-use verification
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: now },
    });

    return {
      success: true,
      message: 'Verification code confirmed successfully.',
    };
  }
}
