import { PrismaClient } from '@prisma/client';

/**
 * Single PrismaClient per process. In dev, hot-reloading tools (tsx watch)
 * would otherwise open a new connection pool on every reload, so the instance
 * is cached on globalThis outside production.
 *
 * DATABASE_URL is resolved by each app's env loader before this module is
 * imported (spec §24: config validated at startup, fail fast).
 */
const createClient = (): PrismaClient =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : process.env.NODE_ENV === 'test'
          ? ['error']
          : ['warn', 'error'],
  });

declare global {
  // eslint-disable-next-line no-var
  var __careergraphPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__careergraphPrisma ?? (process.env.NODE_ENV === 'production' ? createClient() : (globalThis.__careergraphPrisma = createClient()));

/** Health probe used by /readyz and the worker. */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export * from '@prisma/client';
export * from './graph/types.js';
export * from './graph/falkorClient.js';
export * from './graph/queries.js';
