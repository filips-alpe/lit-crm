import { execFileSync } from 'node:child_process';
import { buildTemplate } from './support/db';

/** Runs once: build the app, then migrate + seed the template database. */
export default async function globalSetup() {
  await buildTemplate();
  // The build doesn't read DATABASE_URL at build time; each worker's preview
  // server gets its own DATABASE_URL at start-up (see fixtures.ts).
  execFileSync('bunx', ['vite', 'build'], { stdio: 'inherit' });
}
