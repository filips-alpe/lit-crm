import { test as base, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { cloneTemplate, dropDatabase, urlFor, workerDbName } from './support/db';

const BASE_PORT = 4180;

type WorkerFixtures = {
  /** Connection string of this worker's private database. */
  workerDbUrl: string;
  /** PrismaClient bound to this worker's private database. */
  db: PrismaClient;
  /** Origin of this worker's own app server (talks to this worker's DB). */
  serverUrl: string;
};

/**
 * Import `test`/`expect` from here instead of '@playwright/test'.
 * Each worker gets a clone of the seeded template DB plus its own preview
 * server pointed at it, so specs never share state with dev or each other.
 */
export const test = base.extend<object, WorkerFixtures>({
  workerDbUrl: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires destructuring here
    async ({}, use, workerInfo) => {
      const name = workerDbName(workerInfo.parallelIndex);
      await cloneTemplate(name);
      await use(urlFor(name));
      await dropDatabase(name);
    },
    { scope: 'worker' },
  ],

  db: [
    async ({ workerDbUrl }, use) => {
      const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: workerDbUrl }) });
      await use(client);
      await client.$disconnect();
    },
    { scope: 'worker' },
  ],

  serverUrl: [
    async ({ workerDbUrl }, use, workerInfo) => {
      const port = BASE_PORT + workerInfo.parallelIndex;
      const proc: ChildProcess = spawn(
        'bunx',
        ['vite', 'preview', '--port', String(port), '--strictPort'],
        {
          env: {
            ...process.env,
            DATABASE_URL: workerDbUrl,
            DIRECT_URL: workerDbUrl,
            AUTH_SECRET: process.env.AUTH_SECRET || 'e2e-secret-0123456789abcdef',
          },
          stdio: 'inherit',
        },
      );
      const origin = `http://localhost:${port}`;
      // Real page render (not just an open port) so the first test doesn't race
      // the cold SSR start.
      const deadline = Date.now() + 60_000;
      for (;;) {
        try {
          if ((await fetch(`${origin}/login`)).ok) break;
        } catch {
          // not up yet
        }
        if (Date.now() > deadline) throw new Error(`preview server on ${origin} did not start`);
        await new Promise((r) => setTimeout(r, 250));
      }
      await use(origin);
      proc.kill('SIGTERM');
    },
    { scope: 'worker' },
  ],

  baseURL: async ({ serverUrl }, use) => {
    await use(serverUrl);
  },
});

export { expect };
