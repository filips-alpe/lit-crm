import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { contextUserId } from '$lib/server/db/context';

/**
 * Two clients over one connection pool.
 *
 *  - `prisma` (default export for all app code): every operation runs in a transaction that
 *    first does `set_config('role', 'lit_app', true)` and `set_config('app.user_id', <user>, true)`
 *    (transaction-local, so a pooled connection comes back clean). Row-level security then
 *    decides what the request's user may see and change. Outside a request context (`runAs`)
 *    the user is empty and every table reads empty: it fails closed.
 *  - `prismaOwner`: the plain owner connection, for migrations-adjacent work (seeds, scripts,
 *    test fixtures). Importing it is restricted by ESLint to those files.
 *
 * `sum`, `hours` and `total` are never selected by Prisma (column privileges deny them to
 * lit_app); they come from the view `lit_record_amount` (see `$lib/server/repos/records`).
 *
 * Interactive transactions (`$transaction(async tx => ...)`) are NOT supported on `prisma`:
 * each operation would run in its own transaction, so the callback would silently not be
 * atomic. It throws; use nested writes, the array form `$transaction([...])`, or a single
 * `$queryRaw`.
 *
 * Test-only escape hatch: with LIT_DB_OWNER_FALLBACK=1 (set by vitest.setup.ts for the
 * legacy repo tests) an operation made outside any context runs as the owner. It only works
 * under vitest (process.env.VITEST); anywhere else the app refuses to start with it set, so
 * a stray variable in a deployment cannot switch row-level security off.
 */
if (process.env.LIT_DB_OWNER_FALLBACK === '1' && !process.env.VITEST) {
  throw new Error('LIT_DB_OWNER_FALLBACK is for the vitest suites only; unset it');
}

const base = new PrismaClient({
  adapter: new PrismaPg({ connectionString: `${process.env.DATABASE_URL}`, max: 10 }),
  omit: { record: { sum: true, hours: true, total: true } },
});

export const prismaOwner = base;

/** Owner-mode applies only to the test fallback, outside any request context. */
export const ownerFallback = () =>
  process.env.LIT_DB_OWNER_FALLBACK === '1' &&
  !!process.env.VITEST &&
  contextUserId() === undefined;

export const prisma = base.$extends({
  client: {
    $transaction: ((...args: unknown[]) => {
      if (typeof args[0] === 'function') {
        throw new Error(
          'Interactive $transaction(async tx => ...) is not supported on the scoped prisma client: ' +
            'its operations would not be atomic. Use nested writes, $transaction([...]) or one $queryRaw.',
        );
      }
      return (base.$transaction as (...a: unknown[]) => unknown)(...args);
    }) as typeof base.$transaction,
  },
  query: {
    async $allOperations({ args, query }) {
      if (ownerFallback()) return query(args);
      const uid = contextUserId() ?? '';
      const [, result] = await base.$transaction([
        base.$queryRaw`SELECT set_config('app.user_id', ${uid}, true), set_config('role', 'lit_app', true)`,
        query(args),
      ]);
      return result;
    },
  },
});
