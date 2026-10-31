import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

/**
 * Database plumbing for the e2e suite: one migrated+seeded TEMPLATE database,
 * cloned into one database per Playwright worker (CREATE DATABASE … TEMPLATE).
 *
 * The server URL comes from E2E_DATABASE_URL (any database on the target
 * Postgres server; only host/credentials/port are used). Falls back to the dev
 * docker-compose Postgres. It must be a local server — the suite drops and
 * creates databases.
 */
const DEFAULT_URL = 'postgresql://postgres:postgres@localhost:5433/postgres?schema=public';

export const TEMPLATE_DB = 'lit_crm_e2e_template';
export const workerDbName = (index: number) => `lit_crm_e2e_w${index}`;

export function baseUrl(): URL {
  const url = new URL(process.env.E2E_DATABASE_URL || DEFAULT_URL);
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(
      'e2e: E2E_DATABASE_URL must point at a local Postgres (localhost / 127.0.0.1); ' +
        'the suite creates and drops databases.',
    );
  }
  return url;
}

/** Connection string for a named database on the e2e Postgres server. */
export function urlFor(dbName: string): string {
  const url = baseUrl();
  url.pathname = `/${dbName}`;
  if (!url.searchParams.has('schema')) url.searchParams.set('schema', 'public');
  return url.toString();
}

async function withAdmin<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  // Maintenance DB: CREATE/DROP DATABASE can't run inside the DB being dropped.
  const url = baseUrl();
  url.pathname = '/postgres';
  url.search = '';
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function dropDatabase(name: string): Promise<void> {
  await withAdmin((c) => c.query(`DROP DATABASE IF EXISTS ${ident(name)} WITH (FORCE)`));
}

export async function cloneTemplate(name: string): Promise<void> {
  await dropDatabase(name);
  await withAdmin((c) => c.query(`CREATE DATABASE ${ident(name)} TEMPLATE ${ident(TEMPLATE_DB)}`));
}

/** (Re)creates the template DB, applies migrations and seeds baseline data. */
export async function buildTemplate(): Promise<void> {
  await dropDatabase(TEMPLATE_DB);
  await withAdmin((c) => c.query(`CREATE DATABASE ${ident(TEMPLATE_DB)}`));
  const url = urlFor(TEMPLATE_DB);
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execFileSync('bunx', ['prisma', 'generate'], { env, stdio: 'inherit' });
  execFileSync('bunx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'inherit' });
  execFileSync('bunx', ['prisma', 'db', 'seed'], { env, stdio: 'inherit' });
}
