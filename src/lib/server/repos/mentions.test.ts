import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { listMentionsForRecord } from './mentions';

describe('listMentionsForRecord', () => {
  it('returns a record’s mentions in text order, and nothing for a record without any', async () => {
    const t = await prisma.type.create({ data: { code: 'doc' } });
    await prisma.record.createMany({
      data: [
        { id: 'src', typeId: t.id, text: 'Paris and Rome' },
        { id: 'paris', typeId: t.id, title: 'Paris' },
        { id: 'rome', typeId: t.id, title: 'Rome' },
        { id: 'other', typeId: t.id, text: 'x' },
      ],
    });
    await prisma.mention.createMany({
      data: [
        { recordId: 'src', entityId: 'rome', start: 10, end: 14, surface: 'Rome' },
        { recordId: 'src', entityId: 'paris', start: 0, end: 5, surface: 'Paris' },
      ],
    });
    expect(await listMentionsForRecord('src')).toEqual([
      { entityId: 'paris', start: 0, end: 5, surface: 'Paris' },
      { entityId: 'rome', start: 10, end: 14, surface: 'Rome' },
    ]);
    expect(await listMentionsForRecord('other')).toEqual([]);
  });
});
