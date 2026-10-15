import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    // Integration suites share one Postgres instance: hooks register multiple
    // users (argon2 + OTP email round-trips), which can take >10s under load.
    hookTimeout: 60000,
    // All files hit the same database — parallel workers exhaust the Prisma
    // connection pool and cause cross-file interference. Run files sequentially.
    fileParallelism: false,
  },
});
