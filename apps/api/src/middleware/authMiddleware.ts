import { Request, Response, NextFunction } from 'express';
import { AuthService, JwtPayload } from '../services/authService.js';
import { prisma, UserRole } from '@careergraph/db';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware requiring a valid JWT access token
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Access denied. Bearer token missing.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = AuthService.verifyAccessToken(token);

    // Verify user is not suspended or deleted (GDPR / DPDP & Admin lock)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isSuspended: true, suspendedReason: true, deletedAt: true },
    });

    if (user?.isSuspended || user?.deletedAt) {
      return res.status(403).json({
        code: 'ACCOUNT_SUSPENDED',
        message: user?.suspendedReason || 'Your account has been suspended or deactivated.',
      });
    }

    // Verify session in DB is still active and not revoked
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      return res.status(401).json({
        code: 'SESSION_REVOKED',
        message: 'Your session has been terminated or expired. Please sign in again.',
      });
    }

    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired. Please refresh your session.',
      });
    }

    return res.status(401).json({
      code: 'INVALID_TOKEN',
      message: 'Invalid or forged authentication token.',
    });
  }
}

/**
 * Middleware requiring specific role(s) per Section 4 RBAC
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: `Forbidden: role '${req.user.role}' lacks permission for this resource.`,
      });
    }

    next();
  };
}
