import { PrismaClient } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Prisma client
//
// In development, attach to globalThis to survive Next.js / ts-node hot
// reloads without accumulating connections. In production, a new instance
// is created per process.
//
// Lazy initialization: The PrismaClient is initialized on first property access.
// This prevents crashes upon module import before environment variables are loaded.
//
// Never call new PrismaClient() inline in request handlers.
// ─────────────────────────────────────────────────────────────────────────────

declare const globalThis: {
  __prisma?: PrismaClient;
} & typeof global;

function getPrismaClient(): PrismaClient {
  if (!globalThis.__prisma) {
    if (!process.env['DATABASE_URL']) {
      throw new Error(
        '[database] DATABASE_URL environment variable is not set. ' +
          'Cannot initialize Prisma client. Failing closed.',
      );
    }

    const client = new PrismaClient({
      log:
        process.env['NODE_ENV'] === 'development'
          ? [{ emit: 'event', level: 'query' }, 'info', 'warn', 'error']
          : ['warn', 'error'],
    });

    if (process.env['NODE_ENV'] !== 'production') {
      globalThis.__prisma = client;
    } else {
      return client;
    }
  }

  return globalThis.__prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  },
});
