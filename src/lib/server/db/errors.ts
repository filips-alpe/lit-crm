/**
 * Row-level security, guard triggers and column privileges refuse a write with SQLSTATE
 * 42501; an UPDATE or DELETE of a row the policies filter out surfaces as Prisma P2025
 * ("record not found"), deliberately indistinguishable from a missing row. Both mean "not
 * allowed (or not there)" to the app and become a clean 403/404 or a form error, never 500.
 */
export class ForbiddenError extends Error {
  constructor(message = 'forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

function* chain(e: unknown): Generator<Record<string, unknown>> {
  const seen = new Set<unknown>();
  const stack: unknown[] = [e];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as Record<string, unknown>;
    yield o;
    stack.push(o.cause, o.meta, o.driverAdapterError, o.originalError, o.error);
  }
}

/** True when `e` is a refusal by the database policies (or a not-found that hides one). */
export function asForbidden(e: unknown): boolean {
  if (e instanceof ForbiddenError) return true;
  for (const o of chain(e)) {
    if (o.code === 'P2025' || o.code === '42501') return true;
    if (o.originalCode === '42501' || o.sqlState === '42501' || o.kind === 'PermissionDenied')
      return true;
    const msg = typeof o.message === 'string' ? o.message : '';
    if (/row-level security|permission denied|42501/i.test(msg)) return true;
  }
  return false;
}
