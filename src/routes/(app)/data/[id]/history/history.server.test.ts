import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { runAs } from '$lib/server/db/context';
import { makeWorld } from '$lib/server/db/rls.testutil';
import type { HistoryPage } from '$lib/history/types';
import { GET } from './+server';

const call = (id: string, qs: string, user: { id: string } | null) =>
  runAs(user?.id ?? null, async () =>
    GET({
      params: { id },
      url: new URL(`http://localhost/data/${id}/history${qs}`),
      locals: { user },
    } as never),
  );

describe('/data/[id]/history', () => {
  it('answers 401 JSON when signed out', async () => {
    const res = await call('x', '', null);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('rejects a cursor that is not a number', async () => {
    const w = await makeWorld();
    for (const bad of [
      'abc',
      '1;DROP',
      '-1',
      '1.5',
      '',
      '9223372036854775808',
      '9999999999999999999',
    ]) {
      expect((await call(w.r1.id, `?before=${encodeURIComponent(bad)}`, w.alice)).status).toBe(400);
    }
  });

  it('pages older entries with before', async () => {
    const w = await makeWorld();
    for (const t of ['a', 'b', 'c'])
      await runAs(w.alice.id, () =>
        prisma.record.update({ where: { id: w.r1.id }, data: { title: t } }),
      );

    const first = (await (await call(w.r1.id, '', w.alice)).json()) as HistoryPage;
    expect(first.entries.map((e) => e.values.title)).toEqual(['c', 'b', 'a']);
    const older = (await (
      await call(w.r1.id, `?before=${first.entries[1].id}`, w.alice)
    ).json()) as HistoryPage;
    expect(older.entries.map((e) => e.values.title)).toEqual(['a']);
  });

  it('gives a user who cannot read the record an empty page, never an error', async () => {
    const w = await makeWorld();
    await runAs(w.alice.id, () =>
      prisma.record.update({ where: { id: w.r1.id }, data: { title: 'z' } }),
    );
    const res = await call(w.r1.id, '', w.bob);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [], nextBefore: null });
  });
});
