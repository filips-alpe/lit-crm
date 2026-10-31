import { defineConfig } from '@playwright/test';

// Each worker gets its own database (a clone of a migrated+seeded template) and
// its own preview server — see e2e/fixtures.ts. The databases live on the
// Postgres in E2E_DATABASE_URL (default: the docker-compose one on :5433), so
// the dev database is never touched. `bun run test:e2e` is all you need.
export default defineConfig({
  testMatch: '**/*.e2e.{ts,js}',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: { navigationTimeout: 60_000 },
  fullyParallel: true,
});
