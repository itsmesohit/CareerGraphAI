import jwt from 'jsonwebtoken';
import { prisma } from '@careergraph/db';
import type { UserRole } from '@careergraph/db';
import type {
  ExtensionLoginInput,
  ExtensionSessionDto,
  ExtensionAccountDto,
  ExtensionCaptureResponseDto,
  JobUrlImportInput,
} from '@careergraph/shared';
import { env } from '../../config/env.js';
import { verifyPassword, sha256, generateSecureToken } from '../../utils/crypto.js';
import { jobService } from '../jobs/jobService.js';
import { scrapeOrConstructJob } from '../jobs/urlScraper.js';
import { isLLMEnabled } from '../ai/llmClient.js';

/**
 * Phase 14 — Chrome Extension Service (Manifest V3).
 *
 * The extension cannot use httpOnly refresh-cookie rotation, so it
 * authenticates with a dedicated long-lived (7-day) bearer token backed by a
 * real Session row: revoking the session (device management, admin lock,
 * password change) immediately invalidates the extension too, and requireAuth
 * enforces suspension checks on every call.
 */
const EXTENSION_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EXTENSION_USER_AGENT = 'CareerGraph Chrome Extension (MV3)';

export class ExtensionService {
  /**
   * Password login for the extension popup. Returns a 7-day session token.
   */
  static async login(
    input: ExtensionLoginInput,
    ipAddress?: string
  ): Promise<ExtensionSessionDto> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.deletedAt) {
      throw new Error('Invalid email or password.');
    }
    if (user.isSuspended) {
      throw new Error('Your account has been suspended.');
    }
    if (!user.passwordHash) {
      throw new Error('This account uses passwordless OTP login. Please sign in on the web app first to set a password.');
    }
    if (!user.isEmailVerified) {
      throw new Error('Please verify your email address on the web app before using the extension.');
    }

    const isValid = await verifyPassword(user.passwordHash, input.password);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    const refreshToken = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + EXTENSION_SESSION_TTL_MS);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: sha256(refreshToken),
        userAgent: EXTENSION_USER_AGENT,
        ipAddress,
        expiresAt,
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, sessionId: session.id },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as string,
      },
    };
  }

  /**
   * Popup summary: profile completeness, pipeline size, platform stats, AI status.
   */
  static async getAccount(userId: string): Promise<ExtensionAccountDto> {
    const [user, profile, applicationsCount, jobsAvailable] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } }),
      prisma.candidateProfile.findUnique({ where: { userId }, select: { completenessScore: true } }),
      prisma.application.count({ where: { userId } }),
      prisma.jobPosting.count({ where: { status: 'OPEN' } }),
    ]);

    if (!user) {
      throw new Error('Account not found.');
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as string,
      },
      profileCompleteness: profile?.completenessScore ?? 0,
      applicationsCount,
      jobsAvailable,
      aiEnabled: isLLMEnabled(),
    };
  }

  /**
   * Captures a job posting from the active tab (Schema.org/JobPosting JSON-LD
   * extracted by the content script) and flows it through the standard
   * normalize → dedup → ingest → graph projection pipeline (Spec §9).
   */
  static async captureJob(
    userId: string,
    input: JobUrlImportInput
  ): Promise<ExtensionCaptureResponseDto> {
    const normalized = await scrapeOrConstructJob(input);
    const { job, isNew } = await jobService.ingestJob(normalized, userId);

    return {
      message: isNew
        ? `Saved "${job.title}" at ${job.company} to your CareerGraph pipeline.`
        : `Already tracked: "${job.title}" at ${job.company}. Refreshed its status.`,
      isNew,
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        jobUrl: job.jobUrl,
        location: job.location ?? null,
      },
    };
  }
}
