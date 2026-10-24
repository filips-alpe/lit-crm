import { describe, expect, it } from 'vitest';
import { buildDashboardData, isSelf, type RawDashboardRecord } from './aggregate';
import type { DashboardUser } from './types';

const user: DashboardUser = {
  id: 'u1',
  username: 'bfranklin',
  name: 'Benjamin Franklin',
  bio: null,
  color: '#000',
  avatarSeed: null,
};
const me = {
  id: 'u1',
  username: 'bfranklin',
  name: 'Benjamin Franklin',
  color: '#000',
  avatarSeed: null,
};
const other = { id: 'u2', username: 'dfranklin', name: 'Deborah', color: '#111', avatarSeed: null };
const letter = {
  id: 't1',
  code: 'Letter',
  color: '#a00',
  iconSeed: null,
  layout: null,
  rendererId: null,
};
const payment = {
  id: 't2',
  code: 'Payment',
  color: '#0a0',
  iconSeed: null,
  layout: null,
  rendererId: null,
};
const NOW = new Date('1770-01-01T00:00:00Z');

let n = 0;
function rec(over: Partial<RawDashboardRecord>): RawDashboardRecord {
  n += 1;
  return {
    id: `r${n}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    status: 'ACTIVE',
    title: null,
    description: null,
    note: null,
    references: [],
    date: null,
    start: null,
    end: null,
    sum: null,
    hours: null,
    total: null,
    unit: null,
    from: null,
    to: null,
    fromGeo: null,
    toGeo: null,
    type: letter,
    creator: me,
    assignee: null,
    projects: [],
    ...over,
  };
}

describe('isSelf', () => {
  it('matches full, partial and case-varied names, but not others', () => {
    expect(isSelf('Benjamin Franklin', user)).toBe(true);
    expect(isSelf('  benjamin franklin ', user)).toBe(true);
    expect(isSelf('Franklin', user)).toBe(true);
    expect(isSelf('Polly Hewson', user)).toBe(false);
    expect(isSelf(null, user)).toBe(false);
  });

  it('matches an initial plus surname', () => {
    expect(isSelf('B. Franklin', user)).toBe(true);
    expect(isSelf('X. Franklin', user)).toBe(false);
  });

  it('never matches when the user name is empty', () => {
    expect(isSelf('Benjamin Franklin', { name: '' })).toBe(false);
    expect(isSelf('Anyone', { name: '   ' })).toBe(false);
  });

  it('does not match a blank party name', () => {
    expect(isSelf('   ', user)).toBe(false);
  });

  it('requires whole words, not substrings or very short names', () => {
    expect(isSelf('Frank', user)).toBe(false);
    expect(isSelf('Ben', user)).toBe(false);
    expect(isSelf('Li', { name: 'Alice Li Wong' })).toBe(false);
    expect(isSelf('Li', { name: 'Li' })).toBe(true);
  });
});

describe('buildDashboardData', () => {
  it('is empty-safe', () => {
    const d = buildDashboardData(user, [], NOW);
    expect(d.records).toEqual([]);
    expect(d.range).toEqual({ earliest: null, latest: null });
    expect(d.byYear).toEqual([]);
    expect(d.countsByType).toEqual([]);
  });

  it('sets role and splits created / assigned, sharing objects', () => {
    const a = rec({ creator: me });
    const b = rec({ creator: other, assignee: me });
    const c = rec({ creator: me, assignee: me });
    const d = buildDashboardData(user, [a, b, c], NOW);
    expect(d.records.map((r) => r.role).sort()).toEqual(['assignee', 'both', 'creator']);
    expect(d.created).toHaveLength(2);
    expect(d.assigned).toHaveLength(2);
    expect(d.created.find((r) => r.id === a.id)).toBe(d.records.find((r) => r.id === a.id));
  });

  it('counts by type with created/assigned split, biggest first', () => {
    const d = buildDashboardData(
      user,
      [
        rec({ type: letter }),
        rec({ type: letter, creator: other, assignee: me }),
        rec({ type: payment }),
      ],
      NOW,
    );
    expect(d.countsByType.map((t) => [t.code, t.count, t.created, t.assigned])).toEqual([
      ['Letter', 2, 1, 1],
      ['Payment', 1, 1, 0],
    ]);
  });

  it('computes range and fills year gaps', () => {
    const d = buildDashboardData(
      user,
      [
        rec({ date: new Date('1757-06-01T00:00:00Z') }),
        rec({ start: new Date('1760-02-01T00:00:00Z') }),
        rec({ date: new Date('1757-09-01T00:00:00Z') }),
        rec({}),
      ],
      NOW,
    );
    expect(d.range.earliest?.getUTCFullYear()).toBe(1757);
    expect(d.range.latest?.getUTCFullYear()).toBe(1760);
    expect(d.byYear).toEqual([
      { year: 1757, count: 2 },
      { year: 1758, count: 0 },
      { year: 1759, count: 0 },
      { year: 1760, count: 1 },
    ]);
  });

  it('tallies correspondents by direction, excluding the user', () => {
    const d = buildDashboardData(
      user,
      [
        rec({ from: 'Benjamin Franklin', to: 'Polly Hewson', date: new Date('1760-01-01') }),
        rec({ from: 'Polly Hewson', to: 'Benjamin Franklin', date: new Date('1762-01-01') }),
        rec({ from: 'polly hewson ', to: 'B. Franklin', date: new Date('1761-01-01') }),
        rec({ from: 'Benjamin Franklin', to: 'Peter Collinson' }),
      ],
      NOW,
    );
    const polly = d.correspondents[0];
    expect(polly.name).toBe('Polly Hewson');
    expect([polly.sent, polly.received, polly.total]).toEqual([1, 2, 3]);
    expect(polly.first?.getUTCFullYear()).toBe(1760);
    expect(polly.last?.getUTCFullYear()).toBe(1762);
    expect(d.correspondents.map((c) => c.name)).toContain('Peter Collinson');
  });

  it('counts projects and totals money per type and unit', () => {
    const p = { projectId: 'p1', project: { id: 'p1', code: 'Shop', color: '#f00' } };
    const d = buildDashboardData(
      user,
      [
        rec({ type: payment, sum: 10, total: 12, unit: 'GBP', projects: [p] }),
        rec({ type: payment, sum: 5, total: null, unit: 'GBP', projects: [p] }),
        rec({ type: payment, sum: 3, unit: 'USD' }),
        rec({ type: letter }),
      ],
      NOW,
    );
    expect(d.projects).toEqual([{ id: 'p1', code: 'Shop', color: '#f00', count: 2 }]);
    const gbp = d.money.find((m) => m.unit === 'GBP');
    expect(gbp).toMatchObject({ code: 'Payment', count: 2, sum: 15, total: 12 });
    expect(d.money).toHaveLength(2);
  });

  it('splits recent from upcoming around now', () => {
    const past1 = rec({ date: new Date('1769-01-01T00:00:00Z') });
    const past2 = rec({ date: new Date('1768-01-01T00:00:00Z') });
    const fut2 = rec({ date: new Date('1771-01-01T00:00:00Z') });
    const fut1 = rec({ date: new Date('1770-06-01T00:00:00Z') });
    const d = buildDashboardData(user, [past2, fut2, past1, fut1], NOW);
    expect(d.recent.map((r) => r.id)).toEqual([past1.id, past2.id]);
    expect(d.upcoming.map((r) => r.id)).toEqual([fut1.id, fut2.id]);
  });

  it('collects geo routes with at least one valid coordinate', () => {
    const d = buildDashboardData(
      user,
      [
        rec({ fromGeo: '51.5,-0.12', toGeo: '39.95,-75.16', from: 'London', to: 'Philadelphia' }),
        rec({ toGeo: '48.85,2.35' }),
        rec({ fromGeo: 'garbage' }),
        rec({}),
      ],
      NOW,
    );
    expect(d.geo).toHaveLength(2);
    expect(d.geo.find((g) => g.from === 'London')?.fromGeo).toEqual({ lat: 51.5, lng: -0.12 });
    expect(d.geo.find((g) => g.from === null)?.fromGeo).toBeNull();
  });
});
