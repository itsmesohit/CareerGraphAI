import { Router, Request, Response } from 'express';
import {
  RegisterInputSchema,
  VerifyOtpInputSchema,
  ResendOtpInputSchema,
  LoginInputSchema,
  OtpLoginRequestSchema,
  OtpLoginVerifyRequestSchema,
} from '@careergraph/shared';
import { prisma } from '@careergraph/db';
import { env } from '../config/env.js';
import { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authRateLimiter, otpRequestLimiter } from '../middleware/rateLimitMiddleware.js';

export const authRouter = Router();

const REFRESH_COOKIE_NAME = 'cg_refresh_token';

const getCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // Lax works cleanly with local web and api on different ports
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

/**
 * POST /api/v1/auth/register
 * Register candidate account with Argon2id and trigger email verification OTP
 */
authRouter.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = RegisterInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration parameters.',
        details: parseResult.error.flatten(),
      });
    }

    const ip = req.ip || req.socket.remoteAddress;
    const result = await AuthService.register(parseResult.data, ip);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return res.status(400).json({
      code: 'REGISTRATION_FAILED',
      message: err.message || 'Registration failed.',
    });
  }
});

/**
 * POST /api/v1/auth/verify-otp
 * Verify email OTP code and receive authenticated session tokens
 */
authRouter.post('/verify-otp', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = VerifyOtpInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid verification input.',
        details: parseResult.error.flatten(),
      });
    }

    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const ip = req.ip || req.socket.remoteAddress;

    const result = await AuthService.verifyEmailAndActivate(
      parseResult.data.email,
      parseResult.data.code,
      userAgent,
      ip
    );

    if (!result.success) {
      return res.status(400).json({
        code: result.reason || 'VERIFICATION_FAILED',
        message: result.message,
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    // Attach httpOnly cookie for refresh token
    if (result.refreshToken) {
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());
    }

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (err: any) {
    return res.status(400).json({
      code: 'VERIFICATION_ERROR',
      message: err.message || 'Verification process encountered an error.',
    });
  }
});

/**
 * POST /api/v1/auth/resend-otp
 * Resend OTP code, adhering to 60s cooldown and 3 sends / 15m rate limit
 */
authRouter.post('/resend-otp', otpRequestLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = ResendOtpInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data.',
        details: parseResult.error.flatten(),
      });
    }

    const ip = req.ip || req.socket.remoteAddress;
    const result = await AuthService.resendOtp(
      parseResult.data.email,
      parseResult.data.purpose as any,
      ip
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return res.status(429).json({
      code: 'RESEND_RESTRICTED',
      message: err.message,
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Password login with Argon2id verification
 */
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = LoginInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid credentials format.',
        details: parseResult.error.flatten(),
      });
    }

    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const ip = req.ip || req.socket.remoteAddress;

    const result = await AuthService.loginWithPassword(
      parseResult.data.email,
      parseResult.data.password,
      userAgent,
      ip
    );

    if (result.requiresVerification) {
      return res.status(200).json({
        requiresVerification: true,
        email: result.email,
        message: result.message,
      });
    }

    if (result.refreshToken) {
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());
    }

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (err: any) {
    return res.status(401).json({
      code: 'INVALID_CREDENTIALS',
      message: err.message || 'Invalid email or password.',
    });
  }
});

/**
 * POST /api/v1/auth/login/otp-request
 * Request passwordless login OTP
 */
authRouter.post('/login/otp-request', otpRequestLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = OtpLoginRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid email address.',
      });
    }

    const ip = req.ip || req.socket.remoteAddress;
    const result = await AuthService.requestOtpLogin(parseResult.data.email, ip);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return res.status(400).json({
      code: 'OTP_REQUEST_FAILED',
      message: err.message,
    });
  }
});

/**
 * POST /api/v1/auth/login/otp-verify
 * Confirm passwordless login OTP
 */
authRouter.post('/login/otp-verify', authRateLimiter, async (req: Request, res: Response) => {
  try {
    // Dedicated schema WITHOUT `purpose` — this endpoint is always a LOGIN
    // verification and the web client sends { email, code } only.
    const parseResult = OtpLoginVerifyRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid code format.',
      });
    }

    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const ip = req.ip || req.socket.remoteAddress;

    const result = await AuthService.verifyOtpLogin(
      parseResult.data.email,
      parseResult.data.code,
      userAgent,
      ip
    );

    if (!result.success) {
      return res.status(400).json({
        code: result.reason || 'VERIFICATION_FAILED',
        message: result.message,
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    if (result.refreshToken) {
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());
    }

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (err: any) {
    return res.status(400).json({
      code: 'LOGIN_FAILED',
      message: err.message,
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Rotating refresh token endpoint with token-family reuse detection
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
  const tokenFromBody = req.body?.refreshToken;
  const refreshToken = tokenFromCookie || tokenFromBody;

  if (!refreshToken) {
    return res.status(401).json({
      code: 'REFRESH_TOKEN_REQUIRED',
      message: 'Refresh token cookie or parameter is required.',
    });
  }

  const userAgent = req.headers['user-agent'] || 'Unknown Device';
  const ip = req.ip || req.socket.remoteAddress;

  try {
    const newTokens = await AuthService.rotateRefreshToken(refreshToken, userAgent, ip);

    // Set new refresh token cookie
    res.cookie(REFRESH_COOKIE_NAME, newTokens.refreshToken, getCookieOptions());

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      },
    });
  } catch (err: any) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return res.status(401).json({
      code: 'REFRESH_FAILED',
      message: err.message || 'Session renewal failed.',
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Log out and revoke active refresh token
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

  if (refreshToken) {
    await AuthService.logout(refreshToken);
  }

  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

  return res.status(200).json({
    success: true,
    message: 'Successfully logged out.',
  });
});

/**
 * GET /api/v1/auth/me
 * Retrieve current user profile and session identity
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isEmailVerified: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      code: 'USER_NOT_FOUND',
      message: 'Account no longer exists.',
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      currentSessionId: req.user!.sessionId,
    },
  });
});

/**
 * GET /api/v1/auth/sessions
 * List active sessions for user with current-session indicator
 */
authRouter.get('/sessions', requireAuth, async (req: Request, res: Response) => {
  const sessions = await AuthService.listSessions(req.user!.userId, req.user!.sessionId);

  return res.status(200).json({
    success: true,
    data: sessions,
  });
});

/**
 * DELETE /api/v1/auth/sessions/:id
 * Revoke specific session
 */
authRouter.delete('/sessions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await AuthService.revokeSession(req.user!.userId, req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Session revoked successfully.',
    });
  } catch (err: any) {
    return res.status(400).json({
      code: 'REVOKE_FAILED',
      message: err.message,
    });
  }
});

/**
 * POST /api/v1/auth/sessions/revoke-others
 * Log out all other devices / active sessions
 */
authRouter.post('/sessions/revoke-others', requireAuth, async (req: Request, res: Response) => {
  try {
    await AuthService.revokeOtherSessions(req.user!.userId, req.user!.sessionId);
    return res.status(200).json({
      success: true,
      message: 'All other sessions have been logged out.',
    });
  } catch (err: any) {
    return res.status(400).json({
      code: 'REVOKE_FAILED',
      message: err.message,
    });
  }
});
