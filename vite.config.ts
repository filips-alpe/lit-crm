import 'dotenv/config';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

// The server tests TRUNCATE tables between cases, so they must never point at
// the dev/prod database. Resolve the test URL on its own — NO fallback to
// DATABASE_URL — and hand the dev URL to the setup file so it can refuse to run
// if the two ever coincide (see vitest.setup.ts).
const DEV_DATABASE_URL = process.env.DATABASE_URL ?? '';
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
    }),
  ],
  test: {
    expect: {
      requireAssertions: true,
    },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [
              {
                browser: 'chromium',
                headless: true,
              },
            ],
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**'],
        },
      },
      {
        // Pure (DB-free) node tests: everything the `server` project below
        // doesn't claim. No setup file, so these run without TEST_DATABASE_URL —
        // e.g. in CI steps or sandboxes with no Postgres available.
        extends: './vite.config.ts',
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/**/*.{test,spec}.{js,ts}',
            'prisma/**/*.{test,spec}.{js,ts}',
            'scripts/**/*.{test,spec}.{js,ts}',
          ],
          exclude: [
            'src/**/*.svelte.{test,spec}.{js,ts}',
            'src/lib/server/**',
            'src/**/*.server.test.ts',
          ],
        },
      },
      {
        // DB-backed tests: anything under src/lib/server/** plus route
        // *.server.test.ts files, all of which go through $lib/prisma. These
        // TRUNCATE tables between cases, so they keep the dedicated-DB guard.
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/lib/server/**/*.{test,spec}.{js,ts}', 'src/**/*.server.test.ts'],
          setupFiles: ['./vitest.setup.ts'],
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            DEV_DATABASE_URL,
          },
          // Tests share one Postgres test DB and truncate between tests —
          // run files serially in a single worker to keep that isolation honest.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
});
