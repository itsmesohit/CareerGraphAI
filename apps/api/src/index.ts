import { createApp, logger } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 CareerGraph API server running at http://localhost:${env.PORT}`);
  logger.info(`📚 Swagger OpenAPI documentation at http://localhost:${env.PORT}/api/docs`);
  logger.info(`🩺 Health check at http://localhost:${env.PORT}/api/health/ready`);
});

const gracefulShutdown = () => {
  logger.info('Shutting down API server gracefully...');
  server.close(() => {
    logger.info('API server terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
