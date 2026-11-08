import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaOwner } from '$lib/prisma';
import { runAs } from '$lib/server/db/context';
import { makeWorld, type World } from '$lib/server/db/rls.testutil';
import { actions, load } from './data/[id]/+page.server';
import { load as listLoad } from './data/+page.server';
import { load as adminLayout } from './admin/+layout.server';
import { actions as adminUsers } from './admin/+page.server';
import { actions as typeActions } from './types/[id]/+page.server';
import { load as typeNew } from './types/new/+page.server';

// Routes as the hooks run them: inside runAs(user), with locals.user the full user row.
let w: World;
beforeEach(async () => {
  vi.stubEnv('LIT_DB_OWNER_FALLBACK', '');
  w = await makeWorld();
});
afterEach(() => vi.unstubAllEnvs());

type U = { id: string; isAdmin: boolean };
const ev = (id: string, user: U, form?: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(form ?? {})) fd.set(k, v);
  return {
    url: new URL(`/data/${id}`, 'http://localhost'),
    params: { id },
    locals: { user },
    request: new Request('http://localhost/', { method: 'POST', body: fd }),
  } as never;
};
const asUser = <T>(u: U, fn: () => T | Promise<T>) => runAs(u.id, async () => await fn());

describe('record pages under row-level security', () => {
  it('a stranger gets 404 for a record they cannot read, a reader sees it read-only', async () => {
    await expect(asUser(w.bob, () => load(ev(w.r1.id, w.bob)))).rejects.toMatchObject({
      status: 404,
    });
    const data = (await asUser(w.dora, () => load(ev(w.r2.id, w.dora)))) as never as {
      record: { amountsMasked: boolean; canWrite: boolean; sum: number | null };
      options: { access: { readOnly: boolean; lockCreator: boolean; maskedColumns: string[] } };
    };
    expect(data.record).toMatchObject({ amountsMasked: true, canWrite: false, sum: null });
    expect(data.options.access).toEqual({
      readOnly: true,
      lockCreator: true,
      maskedColumns: ['sum', 'hours', 'total'],
    });
  });

  it('an owner gets an editable form with the creator locked; an admin may change it', async () => {
    const own = (await asUser(w.alice, () => load(ev(w.r1.id, w.alice)))) as never as {
      options: { access: { readOnly: boolean; lockCreator: boolean; maskedColumns: string[] } };
    };
    expect(own.options.access).toEqual({ readOnly: false, lockCreator: true, maskedColumns: [] });
    const admin = (await asUser(w.admin, () => load(ev(w.r1.id, w.admin)))) as never as {
      options: { access: { lockCreator: boolean } };
    };
    expect(admin.options.access.lockCreator).toBe(false);
  });

  it('saving as a reader or stranger is a clean 403/404, as a writer it saves', async () => {
    const reader = await asUser(w.dora, () =>
      actions.save(ev(w.r2.id, w.dora, { title: 'hacked' })),
    );
    expect(reader).toMatchObject({ status: 403 });
    await expect(
      asUser(w.bob, () => actions.save(ev(w.r1.id, w.bob, { title: 'x' }))),
    ).rejects.toMatchObject({ status: 404 });
    const ok = await asUser(w.alice, () =>
      actions.save(ev(w.r1.id, w.alice, { title: 'R1 edited', sum: '101' })),
    );
    expect(ok).not.toMatchObject({ status: expect.any(Number) });
    const row = await prismaOwner.record.findUniqueOrThrow({
      where: { id: w.r1.id },
      omit: { sum: false },
    });
    expect(row.title).toBe('R1 edited');
    expect(Number(row.sum)).toBe(101);
  });

  it('a writer with hidden amounts saves without the amount fields and keeps the amounts', async () => {
    await prismaOwner.grant.update({
      where: { id: (await prismaOwner.grant.findFirstOrThrow()).id },
      data: { level: 'WRITE' },
    });
    // the form no longer carries sum (it is masked): a required number field must not block the save
    const res = await asUser(w.dora, () =>
      actions.save(ev(w.r2.id, w.dora, { title: 'R2 by dora' })),
    );
    expect(res).not.toMatchObject({ status: expect.any(Number) });
    const row = await prismaOwner.record.findUniqueOrThrow({
      where: { id: w.r2.id },
      omit: { sum: false },
    });
    expect(row.title).toBe('R2 by dora');
    expect(Number(row.sum)).toBe(50);
  });

  it('delete: writers delete, readers get 403, strangers 403', async () => {
    await expect(asUser(w.dora, () => actions.delete(ev(w.r2.id, w.dora)))).rejects.toMatchObject({
      status: 403,
    });
    await expect(asUser(w.bob, () => actions.delete(ev(w.r1.id, w.bob)))).rejects.toMatchObject({
      status: 403,
    });
    await expect(asUser(w.alice, () => actions.delete(ev(w.r1.id, w.alice)))).rejects.toMatchObject(
      {
        status: 303,
      },
    );
    expect(await prismaOwner.record.count({ where: { id: w.r1.id } })).toBe(0);
  });

  it('the list shows only readable records with their mask flag', async () => {
    const data = (await asUser(w.dora, () =>
      listLoad({ url: new URL('/data', 'http://localhost'), locals: { user: w.dora } } as never),
    )) as never as { rows: { id: string; amountsMasked: boolean }[]; total: number };
    expect(data.rows.map((r) => r.id)).toEqual([w.r2.id]);
    expect(data.rows[0].amountsMasked).toBe(true);
  });
});

describe('admin-only routes', () => {
  it('the admin area is a 403 for a non-admin and open for an admin', async () => {
    const e = (u: U) => ({ locals: { user: u } }) as never;
    await expect(Promise.resolve().then(() => adminLayout(e(w.alice)))).rejects.toMatchObject({
      status: 403,
    });
    await expect(Promise.resolve().then(() => adminLayout(e(w.admin)))).resolves.toEqual({});
  });

  it('refuses demoting the last admin with a form error', async () => {
    const res = await asUser(w.admin, () =>
      adminUsers.save(ev('', w.admin, { id: w.admin.id, status: 'ACTIVE' })),
    );
    expect(res).toMatchObject({ status: 409 });
    expect((await prismaOwner.user.findUniqueOrThrow({ where: { id: w.admin.id } })).isAdmin).toBe(
      true,
    );
  });

  it('type editing is a 403 for a non-admin and works for an admin', async () => {
    const t = (u: U, form: Record<string, string> = {}) => ev(w.type.id, u, form);
    await expect(asUser(w.alice, () => typeActions.delete(t(w.alice)))).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      Promise.resolve().then(() => typeNew({ locals: { user: w.alice } } as never)),
    ).rejects.toMatchObject({ status: 403 });
    await expect(asUser(w.admin, () => typeActions.delete(t(w.admin)))).rejects.toMatchObject({
      status: 303,
    });
  });
});
