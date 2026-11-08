import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The acting user of the current request, carried through async calls. Every database
 * operation made through the scoped `prisma` client reads it (see `$lib/prisma`) and runs
 * as the non-owner role `lit_app` with `app.user_id` set, so Postgres row-level security
 * decides what the operation may see and change. `userId: null` is a context too: it means
 * "nobody", and every table is empty.
 */
const store = new AsyncLocalStorage<{ userId: string | null }>();

/** The acting user id, null when the context says nobody, undefined outside any context. */
export function contextUserId(): string | null | undefined {
  const s = store.getStore();
  return s ? s.userId : undefined;
}

/** True when code runs inside `runAs` (even as nobody). */
export const inContext = () => store.getStore() !== undefined;

/**
 * Run `fn` as `userId` (null = nobody). The `async` + `await` are REQUIRED: Prisma
 * promises are lazy and run when awaited, so a thenable returned out of `store.run` would
 * execute after the context is gone and silently see nothing.
 */
export const runAs = <T>(userId: string | null, fn: () => Promise<T>): Promise<T> =>
  store.run({ userId }, async () => await fn());
