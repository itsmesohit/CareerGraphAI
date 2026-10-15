import jwt from 'jsonwebtoken';
import { prisma, UserRole } from '@careergraph/db';
import { env } from '../config/env.js';
import { hashPassword, verifyPassword, sha256, generateSecureToken } from '../utils/crypto.js';
import { OtpService } from './otpService.js';
import { RegisterInput } from '@careergraph/shared';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export type AuthVerifyResult =
  | {
      success: false;
      reason?: 'EXPIRED_OR_NOT_FOUND' | 'TOO_MANY_ATTEMPTS' | 'INVALID_CODE';
      message: string;
      attemptsRemaining?: number;
      user?: never;
      accessToken?: never;
      refreshToken?: never;
      sessionId?: never;
    }
  | {
      success: true;
      user: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        isEmailVerified: boolean;
        twoFactorEnabled: boolean;
        createdAt: string;
      };
      accessToken: string;
      refreshToken: string;
      sessionId: string;
      reason?: never;
      message?: string;
      attemptsRemaining?: never;
    };

export type AuthLoginResult =
  | {
      requiresVerification: true;
      email: string;
      message: string;
      user?: never;
      accessToken?: never;
      refreshToken?: never;
      sessionId?: never;
    }
  | {
      requiresVerification: false;
      user: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        isEmailVerified: boolean;
        twoFactorEnabled: boolean;
        createdAt: string;
      };
      accessToken: string;
      refreshToken: string;
      sessionId: string;
      email?: never;
      message?: never;
    };

export class AuthService {
  /**
   * Generates a short-lived (15-minute) signed JWT access token
   */
  static generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
  }

  /**
   * Verifies an access token
   */
  static verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  }

  /**
   * User Registration: Validates uniqueness, hashes password with argon2id,
   * creates user in unverified state, and sends 6-digit email OTP.
   */
  static async register(input: RegisterInput, ipAddress?: string) {
    const email = input.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.isEmailVerified) {
      throw new Error('An account with this email address already exists. Please log in.');
    }

    const passwordHash = await hashPassword(input.password);

    let user;
    if (existingUser && !existingUser.isEmailVerified) {
      // Update existing unverified user
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: input.name.trim(),
          passwordHash,
        },
      });
    } else {
      // Create new candidate user
      user = await prisma.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash,
          role: 'CANDIDATE',
          isEmailVerified: false,
        },
      });
    }

    // Send mandatory VERIFY_EMAIL OTP
    const otpResult = await OtpService.generateAndSendOtp(email, 'VERIFY_EMAIL', ipAddress);

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      requiresVerification: true,
      message: otpResult.message,
      cooldownSeconds: otpResult.cooldownSeconds,
    };
  }

  /**
   * Verify email OTP and establish authenticated session
   */
  static async verifyEmailAndActivate(
    email: string,
    code: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthVerifyResult> {
    const normalizedEmail = email.trim().toLowerCase();

    // Verify OTP
    const otpVerification = await OtpService.verifyOtp(normalizedEmail, code, 'VERIFY_EMAIL');
    if (!otpVerification.success) {
      return otpVerification as AuthVerifyResult;
    }

    // Mark user as verified
    const user = await prisma.user.update({
      where: { email: normalizedEmail },
      data: { isEmailVerified: true },
    });

    // Create session & tokens
    const tokens = await this.createSession(user.id, user.email, user.role, userAgent, ipAddress);

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString(),
      },
      ...tokens,
    };
  }

  /**
   * Resend verification OTP (enforcing 60s cooldown and max 3 sends / 15m)
   */
  static async resendOtp(
    email: string,
    purpose: 'VERIFY_EMAIL' | 'LOGIN' | 'RESET_PASSWORD',
    ipAddress?: string
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    // Check user exists for this email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new Error('No account found with this email address.');
    }

    if (purpose === 'VERIFY_EMAIL' && user.isEmailVerified) {
      throw new Error('Email address is already verified. Please sign in.');
    }

    return await OtpService.generateAndSendOtp(normalizedEmail, purpose, ipAddress);
  }

  /**
   * Password Login: Verifies argon2id hash, checks verification status,
   * and creates a rotating session.
   */
  static async loginWithPassword(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthLoginResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.deletedAt) {
      throw new Error('Invalid email or password.');
    }

    if (!user.passwordHash) {
      throw new Error('This account uses passwordless OTP login. Please sign in with OTP.');
    }

    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    // If not verified, trigger fresh OTP and require verification
    if (!user.isEmailVerified) {
      try {
        await OtpService.generateAndSendOtp(user.email, 'VERIFY_EMAIL', ipAddress);
      } catch {
        // Cooldown might still apply, ignore error
      }
      return {
        requiresVerification: true,
        email: user.email,
        message: 'Your email address is not verified. A verification code has been sent.',
      };
    }

    const tokens = await this.createSession(user.id, user.email, user.role, userAgent, ipAddress);

    return {
      requiresVerification: false,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString(),
      },
      ...tokens,
    };
  }

  /**
   * Request Passwordless Email OTP Login
   */
  static async requestOtpLogin(email: string, ipAddress?: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.deletedAt) {
      throw new Error('No account found with this email. Please register first.');
    }

    const result = await OtpService.generateAndSendOtp(normalizedEmail, 'LOGIN', ipAddress);
    return result;
  }

  /**
   * Verify Passwordless Email OTP Login
   */
  static async verifyOtpLogin(
    email: string,
    code: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthVerifyResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const otpVerification = await OtpService.verifyOtp(normalizedEmail, code, 'LOGIN');
    if (!otpVerification.success) {
      return otpVerification as AuthVerifyResult;
    }

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.deletedAt) {
      throw new Error('Account not found.');
    }

    if (!user.isEmailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      });
    }

    const tokens = await this.createSession(user.id, user.email, user.role, userAgent, ipAddress);

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString(),
      },
      ...tokens,
    };
  }

  /**
   * Rotating Refresh Token with Reuse Detection (Spec Section 5):
   * When an old refresh token is reused, all sessions in that token family are revoked.
   */
  static async rotateRefreshToken(
    oldRefreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    const oldHash = sha256(oldRefreshToken);

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: oldHash },
      include: { user: true },
    });

    if (!session) {
      throw new Error('Invalid refresh token.');
    }

    // Token reuse detection!
    if (session.isRevoked) {
      console.warn(
        `🚨 [SECURITY] Refresh token reuse detected for user ${session.userId}. Revoking family ${session.tokenFamily}.`
      );
      // Invalidate the entire token family
      await prisma.session.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { isRevoked: true },
      });
      throw new Error('Refresh token reuse detected. All sessions in this family have been terminated.');
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      throw new Error('Session has expired. Please sign in again.');
    }

    // Mark old token as revoked (used)
    await prisma.session.update({
      where: { id: session.id },
      data: {
        isRevoked: true,
        lastUsedAt: new Date(),
      },
    });

    // Create new refresh token within the same tokenFamily
    const newRefreshToken = generateSecureToken(32);
    const newHash = sha256(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const newSession = await prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: newHash,
        tokenFamily: session.tokenFamily,
        userAgent: userAgent || session.userAgent,
        ipAddress: ipAddress || session.ipAddress,
        expiresAt,
      },
    });

    const accessToken = this.generateAccessToken({
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sessionId: newSession.id,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      sessionId: newSession.id,
    };
  }

  /**
   * List active sessions for user with current-session indicator
   */
  static async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));
  }

  /**
   * Revoke a specific session
   */
  static async revokeSession(userId: string, sessionId: string) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Session not found.');
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });

    return { success: true };
  }

  /**
   * Log out all other devices/sessions
   */
  static async revokeOtherSessions(userId: string, currentSessionId: string) {
    await prisma.session.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        isRevoked: false,
      },
      data: { isRevoked: true },
    });

    return { success: true };
  }

  /**
   * Logout user by invalidating their refresh token
   */
  static async logout(refreshToken?: string) {
    if (!refreshToken) return;
    const hash = sha256(refreshToken);
    await prisma.session.updateMany({
      where: { refreshTokenHash: hash },
      data: { isRevoked: true },
    });
  }

  /**
   * Helper to create a new session
   */
  private static async createSession(
    userId: string,
    email: string,
    role: UserRole,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    const refreshToken = generateSecureToken(32);
    const refreshTokenHash = sha256(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    const accessToken = this.generateAccessToken({
      userId,
      email,
      role,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
    };
  }
}
