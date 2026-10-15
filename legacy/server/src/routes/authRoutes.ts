import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { EmailService } from '../modules/email/emailService.js';
import { FalkorGraphService } from '../db/falkor/queries.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * Step 1: Initiate Registration & Send 6-digit OTP to Email via Resend
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing && existing.isVerified) {
      return res.status(409).json({ error: 'An active verified account with this email already exists. Please log in.' });
    }

    // Generate random 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    const passwordHash = await bcrypt.hash(password, 10);

    // Save or update OtpVerification record
    await prisma.otpVerification.create({
      data: {
        email: cleanEmail,
        code: otpCode,
        name,
        passwordHash,
        expiresAt,
        verified: false,
      },
    });

    // Send email using Resend with SMTP fallback
    console.log(`[Auth] Dispatching registration OTP to ${cleanEmail}...`);
    const emailResult = await EmailService.sendOtpVerificationEmail(cleanEmail, otpCode, name);

    return res.status(200).json({
      message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
      email: cleanEmail,
      provider: emailResult.provider,
    });
  } catch (error: any) {
    console.error('[Auth Register Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to initiate account registration.' });
  }
});

/**
 * Step 2: Verify 6-digit OTP & Complete Registration
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Find the latest valid OTP verification record
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        email: cleanEmail,
        code: cleanCode,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired verification code. Please check your email or request a new code.' });
    }

    // Mark OTP as verified
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    // Create or activate Tenant
    const tenantSlug = `tenant_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: {
        name: `${otpRecord.name || 'Candidate'}'s Workspace`,
        slug: tenantSlug,
      },
    });

    // Create User record
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: otpRecord.name || user.name,
          passwordHash: otpRecord.passwordHash || user.passwordHash,
          isVerified: true,
          tenantId: tenant.id,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: otpRecord.name || 'Candidate',
          passwordHash: otpRecord.passwordHash || '',
          role: 'CANDIDATE',
          isVerified: true,
          tenantId: tenant.id,
          subscription: {
            create: { plan: 'PRO', status: 'ACTIVE', maxDailyApplications: 25 },
          },
        },
      });
    }

    // Initialize root Candidate node in FalkorDB
    await FalkorGraphService.upsertCandidate(tenant.id, {
      name: user.name,
      email: user.email,
      targetRole: 'Full Stack & AI Engineer',
      minSalary: 120000,
    });

    // Sign JWT Token
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as any
    );

    return res.status(201).json({
      message: 'Account verified successfully!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('[Auth Verify OTP Error]:', error);
    return res.status(500).json({ error: error.message || 'Verification failed.' });
  }
});

/**
 * Step 3: Resend OTP Code
 */
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const cleanEmail = email.trim().toLowerCase();
    const lastVerification = await prisma.otpVerification.findFirst({
      where: { email: cleanEmail, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    const name = lastVerification?.name || 'there';
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpVerification.create({
      data: {
        email: cleanEmail,
        code: otpCode,
        name,
        passwordHash: lastVerification?.passwordHash || '',
        expiresAt,
        verified: false,
      },
    });

    const emailResult = await EmailService.sendOtpVerificationEmail(cleanEmail, otpCode, name);
    return res.json({
      message: `New verification code sent to ${cleanEmail}.`,
      provider: emailResult.provider,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Standard Login & Quick Demo Login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(401).json({ error: 'No account found with this email. Please create an account.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as any
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, tenantId: user.tenantId, role: user.role },
      message: `Welcome back, ${user.name}!`,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Fetch Current Authenticated Session
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    return res.json({ user });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
