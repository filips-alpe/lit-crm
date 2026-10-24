import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { listProjectOptions } from './projects';

describe('listProjectOptions', () => {
  it('returns active projects as id/code/color, code-ordered', async () => {
    await prisma.project.create({ data: { code: 'zeta', color: '#111111' } });
    await prisma.project.create({ data: { code: 'alpha', color: '#222222' } });
    const inactive = await prisma.project.create({ data: { code: 'gone', status: 'INACTIVE' } });

    const opts = await listProjectOptions();
    expect(opts.map((o) => o.code)).toEqual(['alpha', 'zeta']);
    expect(opts.find((o) => o.code === 'alpha')).toEqual({
      id: expect.any(String),
      code: 'alpha',
      color: '#222222',
    });
    expect(opts.some((o) => o.id === inactive.id)).toBe(false);
  });
});
