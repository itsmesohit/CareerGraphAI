import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { pinoHttp } from 'pino-http';
import pino from 'pino';

import { env } from './config/env.js';
import { openApiSpec } from './docs/openapi.js';
import { healthRouter } from './routes/healthRoutes.js';
import { marketingRouter } from './routes/marketingRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { profileRouter } from './routes/profileRoutes.js';
import { resumeRouter } from './routes/resumeRoutes.js';
import { questionRouter } from './routes/questionRoutes.js';
import { onboardingRouter } from './routes/onboardingRoutes.js';
import { graphRouter } from './routes/graphRoutes.js';
import { jobRouter } from './routes/jobRoutes.js';
import { matchRouter } from './routes/matchRoutes.js';
import { applicationRouter } from './routes/applicationRoutes.js';
import { missingInfoRouter } from './routes/missingInfoRoutes.js';
import { approvalRouter } from './routes/approvalRoutes.js';
import { automationRouter } from './routes/automationRoutes.js';
import { integrationsRouter } from './routes/integrationsRoutes.js';
import { outreachRouter } from './routes/outreachRoutes.js';
import { inboundEmailRouter } from './routes/inboundEmailRoutes.js';
import { interviewRouter } from './routes/interviewRoutes.js';
import { billingRouter } from './routes/billingRoutes.js';
import { organizationRouter } from './routes/organizationRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { aiRouter } from './routes/aiRoutes.js';
import { extensionRouter } from './routes/extensionRoutes.js';
import { complianceRouter } from './routes/complianceRoutes.js';
import { apiGeneralRateLimiter } from './middleware/rateLimitMiddleware.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino/file',
        }
      : undefined,
});

export function createApp(): Express {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI inline assets
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS
  app.use(
    cors({
      origin: [env.WEB_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Parsers
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(
    express.json({
      limit: '5mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Logging
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: {
          ignore: (req) => req.url?.startsWith('/api/health') || req.url?.startsWith('/api/docs'),
        },
      })
    );
  }

  // OpenAPI Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Health and Monitoring
  app.use('/api', healthRouter);

  // Public Marketing
  app.use('/api/v1/marketing', marketingRouter);

  // Core Authentication & Session
  app.use('/api/v1/auth', authRouter);

  // Profile & Resume Management (Phase 2)
  app.use('/api/v1/profile', profileRouter);
  app.use('/api/v1/resumes', resumeRouter);
  app.use('/api/v1/questions', questionRouter);
  app.use('/api/v1/onboarding', onboardingRouter);

  // Graph Memory & Outbox Projection (Phase 3)
  app.use('/api/v1/graph', graphRouter);

  // Job Discovery Engine (Phase 4)
  app.use('/api/v1/jobs', jobRouter);

  // Deterministic Matching Engine (Phase 5)
  app.use('/api/v1/matches', matchRouter);

  // Application Lifecycle & Human-in-the-Loop (Phase 6)
  app.use('/api/v1/applications', applicationRouter);
  app.use('/api/v1/missing-info', missingInfoRouter);
  app.use('/api/v1/approvals', approvalRouter);

  // Assisted Apply & Automation Channels (Phase 7)
  app.use('/api/v1/automation', automationRouter);

  // Email Integration & Recruiter Outreach (Phase 8)
  app.use('/api/v1/integrations', integrationsRouter);
  app.use('/api/v1/outreach', outreachRouter);
  app.use('/api/v1/inbound-emails', inboundEmailRouter);
  app.use('/api/v1/interviews', interviewRouter);

  // Plans, Billing & Metering (Phase 9)
  app.use('/api/v1/billing', billingRouter);

  // Multi-Tenant Organizations (Phase 10)
  app.use('/api/v1/organizations', organizationRouter);

  // Administration, Hardening & Security (Phase 11)
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/compliance', complianceRouter);

  // AI Layer (Phase 13) — NVIDIA NIM powered copilot & specialist agents
  app.use('/api/v1/ai', aiRouter);

  // Chrome Extension API (Phase 14) — job capture & popup session
  app.use('/api/v1/extension', extensionRouter);

  // Fallback 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
    });
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled request error');
    res.status(err.status || 500).json({
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected server error occurred.',
    });
  });

  return app;
}
