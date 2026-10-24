import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { listUserOptions } from './users';

describe('listUserOptions', () => {
  it('returns active users as id/name/username/color/avatarSeed, name-ordered', async () => {
    await prisma.user.create({ data: { username: 'zeb', name: 'Zeb', color: '#111111' } });
    await prisma.user.create({
      data: { username: 'amy', name: 'Amy', color: '#222222', avatarSeed: 'seed' },
    });
    const inactive = await prisma.user.create({
      data: { username: 'ina', name: 'Ina', status: 'INACTIVE' },
    });

    const opts = await listUserOptions();
    expect(opts.map((o) => o.name)).toEqual(['Amy', 'Zeb']);
    expect(opts.find((o) => o.username === 'amy')).toMatchObject({
      color: '#222222',
      avatarSeed: 'seed',
    });
    expect(opts.some((o) => o.id === inactive.id)).toBe(false);
  });
});
