import { defineConfig } from '@playwright/test';

// These tests write real data, so run them against a DEDICATED local Postgres,
// never the Neon URL in .env. The build+preview webServer inherits whatever
// DATABASE_URL/DIRECT_URL are in the environment when you invoke playwright:
//   E="postgresql://postgres:postgres@localhost:5434/lit_crm_e2e?schema=public"
//   export E DIRECT_URL="$E" DATABASE_URL="$E"
//   bunx prisma migrate deploy && bunx prisma db seed   # first run / after a reset
//   bunx playwright test
// (export the vars in separate statements — `export A=.. B=$A` in one command
// expands $A against the pre-command environment, not the new value of A.)
// Refuse to run against anything but a local Postgres: the specs write real data.
const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname;
  } catch {
    return '';
  }
})();
if (dbHost !== 'localhost' && dbHost !== '127.0.0.1') {
  throw new Error(
    'playwright: DATABASE_URL must point at a local Postgres (localhost / 127.0.0.1); ' +
      'these e2e specs write real data. See the instructions above.',
  );
}

export default defineConfig({
  webServer: { command: 'npm run build && npm run preview', port: 4173 },
  testMatch: '**/*.e2e.{ts,js}',
});
