import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma, prismaOwner } from '$lib/prisma';
import { runAs } from './context';
import { makeWorld } from './rls.testutil';

afterEach(() => vi.unstubAllEnvs());

// These tests turn the legacy owner fallback OFF: everything here is scoped like production.
const scoped = () => vi.stubEnv('LIT_DB_OWNER_FALLBACK', '');

describe('request context', () => {
  it('outside any context the scoped client sees nothing and writes nothing', async () => {
    scoped();
    const w = await makeWorld();
    expect(await prismaOwner.record.count()).toBe(3);
    expect(await prisma.record.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.type.findMany()).toEqual([]);
    await expect(
      prisma.record.create({ data: { typeId: w.type.id, creatorId: w.alice.id } }),
    ).rejects.toThrow();
    await expect(prisma.type.create({ data: { code: 'x' } })).rejects.toThrow();
    expect(await prismaOwner.record.count()).toBe(3);
  });

  it('runAs(null) is nobody; an unknown or inactive user is nobody too', async () => {
    scoped();
    const w = await makeWorld();
    expect(await runAs(null, () => prisma.record.count())).toBe(0);
    expect(await runAs('no-such-user', () => prisma.record.count())).toBe(0);
    expect(await runAs(w.gone.id, () => prisma.record.count())).toBe(0);
    expect(await runAs(w.gone.id, () => prisma.user.count())).toBe(0);
  });

  it('runAs awaits inside: returning an un-awaited Prisma promise still runs as that user', async () => {
    scoped();
    const w = await makeWorld();
    // Prisma promises are lazy; a thenable escaping store.run would execute without a context.
    const n = await runAs(w.alice.id, () => prisma.record.count());
    expect(n).toBe(1); // R1 only: alice's hidden record is invisible even to its creator
    expect(await runAs(w.admin.id, () => prisma.record.count())).toBe(3);
  });

  it('interleaved users never see each other (no cross-talk across 300 concurrent operations)', async () => {
    scoped();
    const w = await makeWorld();
    const users = [w.admin, w.alice, w.bob, w.dora, w.gone];
    const expected = new Map([
      [w.admin.id, ['R1', 'R2', 'Rh']],
      [w.alice.id, ['R1']],
      [w.bob.id, ['R2']],
      [w.dora.id, ['R2']],
      [w.gone.id, []],
    ]);
    const jobs = Array.from({ length: 300 }, (_, i) => {
      const u = users[i % users.length];
      return runAs(u.id, async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        const [rows, ctx] = await Promise.all([
          prisma.record.findMany({ select: { title: true }, orderBy: { title: 'asc' } }),
          prisma.$queryRaw<{ uid: string; role: string }[]>`
            SELECT current_setting('app.user_id', true) AS uid, current_user AS role`,
        ]);
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        return { u: u.id, titles: rows.map((r) => r.title), ctx: ctx[0] };
      });
    });
    for (const r of await Promise.all(jobs)) {
      expect(r.titles).toEqual(expected.get(r.u));
      expect(r.ctx).toEqual({ uid: r.u, role: 'lit_app' });
    }
    // the settings were transaction-local: a pooled connection comes back clean
    const [clean] = await prismaOwner.$queryRaw<{ uid: string; role: string }[]>`
      SELECT coalesce(current_setting('app.user_id', true), '') AS uid, current_user AS role`;
    expect(clean.uid).toBe('');
    expect(clean.role).not.toBe('lit_app');
  });

  it('login lists and resolves active users through the definer functions, with no table access', async () => {
    scoped();
    await makeWorld();
    const list = await runAs(
      null,
      () => prisma.$queryRaw<{ username: string }[]>`SELECT username FROM lit_login_users()`,
    );
    expect(list.map((u) => u.username).sort()).toEqual(['admin', 'alice', 'bob', 'dora']);
    const [alice] = await runAs(
      null,
      () => prisma.$queryRaw<{ id: string }[]>`SELECT id FROM lit_resolve_user(${'alice'})`,
    );
    expect(alice.id).toBeTruthy();
    expect(
      await runAs(null, () => prisma.$queryRaw`SELECT id FROM lit_resolve_user(${'gone'})`),
    ).toEqual([]);
  });

  it('refuses an interactive $transaction instead of silently running it non-atomically (F7)', async () => {
    scoped();
    const w = await makeWorld();
    const before = await prismaOwner.record.count();
    await expect(
      runAs(w.alice.id, () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).$transaction(async (tx: typeof prisma) => {
          await tx.record.create({ data: { typeId: w.type.id, creatorId: w.alice.id } });
          throw new Error('would be rolled back if atomic');
        }),
      ),
    ).rejects.toThrow(/Interactive \$transaction.*not supported/);
    expect(await prismaOwner.record.count()).toBe(before);
    // the array form still works and is atomic under the same role and user id
    const [n] = await runAs(w.alice.id, () => prisma.$transaction([prisma.record.count()]));
    expect(n).toBe(1);
  });
});
