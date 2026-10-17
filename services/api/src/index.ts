import { loadEnv } from './env';
import { initFirebaseAdmin } from '@bizflow/auth';
import { prisma } from '@bizflow/database';
import { createApp } from './app';
import { logger } from './logger';

async function main(): Promise<void> {
  // 1. Validate environment — fails closed before any listener opens
  const env = loadEnv();

  // 2. Initialize Firebase Admin — fails closed if FIREBASE_PROJECT_ID missing
  initFirebaseAdmin();
  logger.info('Firebase Admin initialized');

  // 3. Verify database connectivity
  await prisma.$connect();
  logger.info('Database connected');

  // 4. Create and start HTTP application
  const app = createApp(env);
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'BizFlow API started');
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(() => {
      void (async () => {
        try {
          await prisma.$disconnect();
          logger.info('Database disconnected cleanly');
        } catch (err: unknown) {
          logger.error({ err }, 'Error during database disconnect');
        }
        process.exit(0);
      })();
    });
    // Force exit after 10s if graceful shutdown stalls
    setTimeout(() => {
      logger.warn('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

main().catch((err: unknown) => {
  // Use console.error here because the logger may not be initialized yet
  console.error('[fatal] API startup failed:', err);
  process.exit(1);
});
