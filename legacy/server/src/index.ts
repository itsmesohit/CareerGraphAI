import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { falkor } from './db/falkor/falkorClient.js';
import { initializeGraphSchema } from './db/falkor/schema.js';
import { ProfileService } from './modules/profile/profileService.js';
import { JobDiscoveryEngine } from './modules/jobs/jobService.js';

import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import jobsRoutes from './routes/jobsRoutes.js';
import applicationsRoutes from './routes/applicationsRoutes.js';
import memoryRoutes from './routes/memoryRoutes.js';
import outreachRoutes from './routes/outreachRoutes.js';
import graphRoutes from './routes/graphRoutes.js';
import usageRoutes from './routes/usageRoutes.js';
import integrationsRoutes from './routes/integrationsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    falkorMode: falkor.getMode(),
    environment: env.NODE_ENV,
    version: '1.0.0'
  });
});

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/jobs', jobsRoutes);
app.use('/api/v1/applications', applicationsRoutes);
app.use('/api/v1/memory', memoryRoutes);
app.use('/api/v1/outreach', outreachRoutes);
app.use('/api/v1/graph', graphRoutes);
app.use('/api/v1/usage', usageRoutes);
app.use('/api/v1/integrations', integrationsRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[CareerGraph Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    path: req.path
  });
});

// Server Initialization
async function startServer() {
  try {
    console.log('--- CareerGraph AI Backend Starting ---');
    await falkor.initialize();
    await initializeGraphSchema();

    app.listen(env.PORT, () => {
      console.log(`🚀 CareerGraph AI Server running on http://localhost:${env.PORT}`);
      console.log(`📡 FalkorDB Mode: ${falkor.getMode()}`);
      console.log(`🔗 API Base: http://localhost:${env.PORT}/api/v1`);
    });
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app };
