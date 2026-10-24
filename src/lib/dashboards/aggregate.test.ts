import { describe, expect, it } from 'vitest';
import { fillYears, foldCorrespondents, isSelf, roleOf } from './aggregate';
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

describe('foldCorrespondents', () => {
  const pair = (
    from: string | null,
    to: string | null,
    count: number,
    y1?: number,
    y2?: number,
  ) => ({
    from,
    to,
    count,
    first: y1 ? new Date(Date.UTC(y1, 0, 1)) : null,
    last: y2 ? new Date(Date.UTC(y2, 0, 1)) : null,
  });

  it('tallies by direction, excluding the user, merging name variants', () => {
    const out = foldCorrespondents(
      [
        pair('Polly Hewson', 'Benjamin Franklin', 1, 1762, 1762),
        pair('polly hewson ', 'B. Franklin', 1, 1761, 1761),
        pair('Benjamin Franklin', 'Polly Hewson', 1, 1760, 1760),
        pair('Benjamin Franklin', 'Peter Collinson', 1),
      ],
      user,
    );
    const polly = out[0];
    expect(polly.name).toBe('Polly Hewson');
    expect([polly.sent, polly.received, polly.total]).toEqual([1, 2, 3]);
    expect(polly.first?.getUTCFullYear()).toBe(1760);
    expect(polly.last?.getUTCFullYear()).toBe(1762);
    expect(out.map((c) => c.name)).toContain('Peter Collinson');
  });

  it('weights by count and ignores blank parties', () => {
    const out = foldCorrespondents([pair('  ', 'Ann Lee', 4)], user);
    expect(out).toEqual([
      { name: 'Ann Lee', sent: 0, received: 0, total: 4, first: null, last: null },
    ]);
  });

  it('is empty-safe', () => {
    expect(foldCorrespondents([], user)).toEqual([]);
  });
});

describe('fillYears', () => {
  it('fills gaps with zero and sorts ascending', () => {
    expect(
      fillYears([
        { year: 1760, count: 1 },
        { year: 1757, count: 2 },
      ]),
    ).toEqual([
      { year: 1757, count: 2 },
      { year: 1758, count: 0 },
      { year: 1759, count: 0 },
      { year: 1760, count: 1 },
    ]);
  });

  it('does not zero-fill an absurd span', () => {
    expect(
      fillYears([
        { year: 1757, count: 1 },
        { year: 1, count: 1 },
      ]),
    ).toEqual([
      { year: 1, count: 1 },
      { year: 1757, count: 1 },
    ]);
  });

  it('is empty-safe', () => {
    expect(fillYears([])).toEqual([]);
  });
});

describe('roleOf', () => {
  it('distinguishes creator, assignee and both', () => {
    expect(roleOf({ creator: me, assignee: null }, 'u1')).toBe('creator');
    expect(roleOf({ creator: other, assignee: me }, 'u1')).toBe('assignee');
    expect(roleOf({ creator: me, assignee: me }, 'u1')).toBe('both');
  });
});
