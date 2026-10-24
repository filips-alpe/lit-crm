import { describe, expect, it } from 'vitest';
import { load } from './+page.server';
import { addType } from '$lib/server/repos/types';

describe('/types page', () => {
  it('load returns the current rows', async () => {
    await addType({ code: 'L1' });
    const data = await (load as never as (e: unknown) => Promise<{ rows: { code: string }[] }>)({
      locals: { user: { id: 'u1' } },
    } as never);
    expect(data.rows.map((r) => r.code)).toContain('L1');
  });

  it('load redirects unauthenticated callers to /login', async () => {
    await expect(
      (load as never as (e: unknown) => Promise<unknown>)({ locals: {} } as never),
    ).rejects.toSatisfy((e) => (e as { location?: string }).location === '/login');
  });
});
