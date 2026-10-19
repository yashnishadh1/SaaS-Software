import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import type { Env } from './env';
import { logger } from './logger';

// ── Route handlers ───────────────────────────────────────────────────────────
import { meRouter } from './routes/me';
import { workspacesRouter } from './routes/workspaces';
import { customersRouter } from './routes/customers';

export function createApp(env: Env): express.Application {
  const app = express();

  // ── Security headers (Helmet) ───────────────────────────────────────────────
  app.use(helmet());

  // ── CORS — only allow configured origin ─────────────────────────────────────
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: false, // no cookies; bearer-token-only API
    }),
  );

  // ── Body parsing ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '64kb' }));

  // ── Structured HTTP logging ──────────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      // Redact Authorization header from logs
      customReceivedMessage: () => 'incoming request',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    }),
  );

  // ── Global rate limit ────────────────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { error: 'too_many_requests', message: 'Rate limit exceeded.' },
  });
  app.use(globalLimiter);

  // ── Tighter limit for workspace creation ─────────────────────────────────────
  const workspaceCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: {
      error: 'too_many_requests',
      message: 'Workspace creation rate limit exceeded.',
    },
  });

  // ── Health endpoint — no sensitive diagnostics ───────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // ── API routes ───────────────────────────────────────────────────────────────
  app.use('/me', meRouter);
  app.post('/workspaces', workspaceCreateLimiter);
  app.use('/workspaces', workspacesRouter);
  app.use('/workspaces/:workspaceId/customers', customersRouter);

  // ── 404 handler ──────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', message: 'Route not found.' });
  });

  // ── Global error handler ─────────────────────────────────────────────────────
  // Must have 4 parameters for Express to treat it as an error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(
      {
        err: err instanceof Error ? { message: err.message, name: err.name } : err,
      },
      'Unhandled error',
    );
    res.status(500).json({ error: 'internal_server_error', message: 'An error occurred.' });
  });

  return app;
}
