import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { resolveUserOptions, searchUserOptions } from './users';

describe('searchUserOptions', () => {
  it('returns active users as id/name/username/color/avatarSeed, name-ordered', async () => {
    await prisma.user.create({ data: { username: 'zeb', name: 'Zeb', color: '#111111' } });
    await prisma.user.create({
      data: { username: 'amy', name: 'Amy', color: '#222222', avatarSeed: 'seed' },
    });
    const inactive = await prisma.user.create({
      data: { username: 'ina', name: 'Ina', status: 'INACTIVE' },
    });

    const opts = await searchUserOptions();
    expect(opts.map((o) => o.name)).toEqual(['Amy', 'Zeb']);
    expect(opts.find((o) => o.username === 'amy')).toMatchObject({
      color: '#222222',
      avatarSeed: 'seed',
    });
    expect(opts.some((o) => o.id === inactive.id)).toBe(false);
  });

  it('filters by name or username case-insensitively and honours the limit', async () => {
    await prisma.user.create({ data: { username: 'grace', name: 'Grace Hopper' } });
    await prisma.user.create({ data: { username: 'gh2', name: 'Other' } });
    await prisma.user.create({ data: { username: 'zed', name: 'Zed' } });

    expect((await searchUserOptions({ q: 'HOPP' })).map((o) => o.username)).toEqual(['grace']);
    expect((await searchUserOptions({ q: 'gh2' })).map((o) => o.name)).toEqual(['Other']);
    expect(await searchUserOptions({ limit: 2 })).toHaveLength(2);
  });
});

describe('resolveUserOptions', () => {
  it('resolves only the requested ids (even inactive ones) and nothing for an empty list', async () => {
    const a = await prisma.user.create({ data: { username: 'ra', name: 'Ra' } });
    const b = await prisma.user.create({
      data: { username: 'rb', name: 'Rb', status: 'INACTIVE' },
    });
    await prisma.user.create({ data: { username: 'rc', name: 'Rc' } });

    const opts = await resolveUserOptions([a.id, b.id]);
    expect(opts.map((o) => o.id).sort()).toEqual([a.id, b.id].sort());
    expect(await resolveUserOptions([])).toEqual([]);
  });
});
