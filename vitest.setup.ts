import { afterAll, afterEach } from 'vitest';
import { prisma } from './src/lib/prisma';

// These tests TRUNCATE the database after every case. Refuse to run unless a
// dedicated TEST_DATABASE_URL (distinct from the dev DATABASE_URL) is set, so a
// stray `bun run test` can never wipe development data. See .env.example.
const testUrl = process.env.DATABASE_URL ?? '';
const devUrl = process.env.DEV_DATABASE_URL ?? '';
if (!testUrl) {
  throw new Error(
    'Server tests need a dedicated TEST_DATABASE_URL — the truncating setup would otherwise ' +
      'wipe your dev database. Point it at a separate database (e.g. a Neon branch) and migrate ' +
      'it (`DATABASE_URL=$TEST_DATABASE_URL bunx prisma migrate deploy`). See .env.example.',
  );
}
if (testUrl === devUrl) {
  throw new Error(
    'TEST_DATABASE_URL must differ from DATABASE_URL — refusing to truncate the dev database. ' +
      'Use a separate database (e.g. a Neon branch) for tests. See .env.example.',
  );
}

const TABLES = [
  'lit_mention',
  'lit_project_record',
  'lit_record',
  'lit_project',
  'lit_type',
  'lit_user',
];

afterEach(async () => {
  const list = TABLES.map((t) => `"${t}"`).join(',');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
