import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { recordInclude } from '$lib/server/repos/records';
import { DASHBOARD_RECORDS_LIMIT, DASHBOARD_TYPE_LIST_LIMIT } from '$lib/dashboards/limits';
import type { DashboardUser } from '$lib/dashboards/types';
import type { FormLayout } from '$lib/forms/layout';
import { loadDashboardData } from './dashboard';
import {
  buildReferenceDashboard,
  type RawDashboardRecord,
} from './testing/dashboard.oracle.testutil';

const NOW = new Date('1770-01-01T00:00:00Z');

async function makeUser(username: string, name: string): Promise<DashboardUser> {
  const u = await prisma.user.create({ data: { username, name, color: '#123456' } });
  return {
    id: u.id,
    username,
    name,
    bio: null,
    color: u.color,
    avatarSeed: null,
  };
}

/** The pre-SQL pipeline: load every owned record, fold in memory. */
async function reference(user: DashboardUser) {
  const rows = await prisma.record.findMany({
    where: { status: 'ACTIVE', OR: [{ creatorId: user.id }, { assigneeId: user.id }] },
    omit: { text: true },
    include: {
      type: recordInclude.type,
      creator: recordInclude.creator,
      assignee: recordInclude.assignee,
      projects: recordInclude.projects,
    },
  });
  const raw: RawDashboardRecord[] = rows.map((r) => ({
    ...r,
    sum: r.sum == null ? null : Number(r.sum),
    total: r.total == null ? null : Number(r.total),
    type: { ...r.type, layout: r.type.layout as FormLayout | null },
  }));
  return buildReferenceDashboard(user, raw, NOW);
}

describe('loadDashboardData', () => {
  it('is empty-safe', async () => {
    const user = await makeUser('empty', 'Nobody');
    const d = await loadDashboardData(user, NOW);
    expect(d).toMatchObject({
      total: 0,
      records: [],
      truncated: false,
      byType: {},
      countsByType: [],
      byYear: [],
      correspondents: [],
      correspondentCount: 0,
      range: { earliest: null, latest: null },
    });
  });

  it('matches the in-memory aggregation on a mixed fixture', async () => {
    const me = await makeUser('bfranklin', 'Benjamin Franklin');
    const other = await makeUser('dfranklin', 'Deborah');
    const letter = await prisma.type.create({ data: { code: 'Letter', color: '#aa0000' } });
    const payment = await prisma.type.create({ data: { code: 'Payment', color: '#00aa00' } });
    const shop = await prisma.project.create({ data: { code: 'Shop', color: '#ff0000' } });
    const d = (s: string) => new Date(s);
    const mk = (data: Record<string, unknown>) =>
      prisma.record.create({ data: { typeId: letter.id, creatorId: me.id, ...data } as never });

    await mk({
      date: d('1757-06-01T00:00:00Z'),
      from: 'Benjamin Franklin',
      to: 'Polly Hewson',
      fromGeo: '51.5,-0.12',
      toGeo: '39.95,-75.16',
    });
    await mk({
      date: d('1762-01-01T00:00:00Z'),
      from: 'Polly Hewson',
      to: 'Benjamin Franklin',
    });
    await mk({
      date: d('1761-01-01T00:00:00Z'),
      from: 'polly  hewson ',
      to: 'B. Franklin',
      toGeo: '48.85,2.35',
    });
    await mk({
      start: d('1760-02-01T00:00:00Z'),
      from: 'Benjamin Franklin',
      to: 'Peter Collinson',
    });
    await mk({ date: d('1760-02-01T00:00:00Z'), fromGeo: 'garbage' });
    await mk({}); // undated
    await mk({ date: d('1769-01-01T00:00:00Z'), creatorId: other.id, assigneeId: me.id });
    await mk({ date: d('1770-06-01T00:00:00Z'), creatorId: me.id, assigneeId: me.id });
    await mk({ date: d('1771-01-01T00:00:00Z') });
    await mk({ date: d('1763-01-01T00:00:00Z'), creatorId: other.id }); // not mine
    await mk({ date: d('1764-01-01T00:00:00Z'), status: 'INACTIVE' }); // inactive
    const pay = (data: Record<string, unknown>) => mk({ typeId: payment.id, ...data });
    await pay({ sum: 10, total: 12.5, unit: 'GBP', date: d('1758-03-01T00:00:00Z') });
    await pay({ sum: 5.25, unit: 'GBP', projects: { create: { projectId: shop.id } } });
    await pay({ sum: 3, unit: 'USD', projects: { create: { projectId: shop.id } } });

    const user = me;
    const sql = await loadDashboardData(user, NOW);
    const js = await reference(user);

    expect(sql.total).toBe(js.records.length);
    expect(sql.createdCount).toBe(js.created.length);
    expect(sql.assignedCount).toBe(js.assigned.length);
    expect(sql.records.map((r) => r.id)).toEqual(js.records.map((r) => r.id));
    expect(sql.records.map((r) => r.role)).toEqual(js.records.map((r) => r.role));
    expect(sql.truncated).toBe(false);
    expect(sql.countsByType).toEqual(js.countsByType);
    expect(sql.range).toEqual(js.range);
    expect(sql.byYear).toEqual(js.byYear);
    expect(sql.correspondents).toEqual(js.correspondents);
    expect(sql.correspondentCount).toBe(js.correspondents.length);
    expect(sql.projects).toEqual(js.projects);
    expect(sql.money).toHaveLength(js.money.length);
    for (const m of js.money) {
      const got = sql.money.find((x) => x.typeId === m.typeId && x.unit === m.unit);
      expect(got).toMatchObject({ code: m.code, count: m.count });
      expect(got?.sum).toBeCloseTo(m.sum, 2);
      expect(got?.total).toBeCloseTo(m.total, 2);
    }
    expect(sql.recent.map((r) => r.id)).toEqual(js.recent.map((r) => r.id));
    expect(sql.upcoming.map((r) => r.id)).toEqual(js.upcoming.map((r) => r.id));
    expect(sql.upcoming.length).toBeGreaterThan(0);
    expect(sql.geo).toEqual(js.geo);
    expect(sql.geo.length).toBe(2);
  });

  it('lists the newest records of every type even when the capped list holds only one', async () => {
    const me = await makeUser('bytype', 'By Type');
    const note = await prisma.type.create({ data: { code: 'Note', color: '#000000' } });
    const old = await prisma.type.create({ data: { code: 'Old', color: '#111111' } });
    await prisma.record.createMany({
      data: Array.from({ length: DASHBOARD_RECORDS_LIMIT + 1 }, (_, i) => ({
        typeId: note.id,
        creatorId: me.id,
        date: new Date(Date.UTC(1700, 0, 1 + (i % 28))),
      })),
    });
    const extra = DASHBOARD_TYPE_LIST_LIMIT + 3;
    await prisma.record.createMany({
      data: Array.from({ length: extra }, (_, i) => ({
        typeId: old.id,
        creatorId: me.id,
        date: new Date(Date.UTC(1600, 0, 1 + i)),
      })),
    });
    const d = await loadDashboardData(me, NOW);
    expect(d.records.every((r) => r.type.code === 'Note')).toBe(true);
    expect(d.byType.Old).toHaveLength(DASHBOARD_TYPE_LIST_LIMIT);
    expect(d.byType.Old[0].date).toEqual(new Date(Date.UTC(1600, 0, extra)));
    expect(d.byType.Note).toHaveLength(DASHBOARD_TYPE_LIST_LIMIT);
  });

  it('caps the record list but keeps aggregates over everything', async () => {
    const me = await makeUser('many', 'Many Records');
    const type = await prisma.type.create({ data: { code: 'Note', color: '#000000' } });
    const extra = 5;
    await prisma.record.createMany({
      data: Array.from({ length: DASHBOARD_RECORDS_LIMIT + extra }, (_, i) => ({
        typeId: type.id,
        creatorId: me.id,
        date: new Date(Date.UTC(1700 + (i % 50), 0, 1)),
      })),
    });
    const sql = await loadDashboardData(me, NOW);
    expect(sql.records).toHaveLength(DASHBOARD_RECORDS_LIMIT);
    expect(sql.truncated).toBe(true);
    expect(sql.total).toBe(DASHBOARD_RECORDS_LIMIT + extra);
    expect(sql.countsByType[0].count).toBe(DASHBOARD_RECORDS_LIMIT + extra);
    expect(sql.byYear.reduce((n, y) => n + y.count, 0)).toBe(DASHBOARD_RECORDS_LIMIT + extra);
    const js = await reference(me);
    expect(sql.records.map((r) => r.id)).toEqual(
      js.records.slice(0, DASHBOARD_RECORDS_LIMIT).map((r) => r.id),
    );
  });
});
