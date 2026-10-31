import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { seedJefferson } from '../../../../prisma/seed/jefferson/seed';
import recordsJson from '../../../../prisma/seed/generated/jefferson/records.json';
import entitiesJson from '../../../../prisma/seed/generated/jefferson/entities.json';
import mentionsJson from '../../../../prisma/seed/generated/jefferson/mentions.json';

describe('seedJefferson (DB)', () => {
  it('loads types, projects, records, entities and mentions; mentions slice to their surface', async () => {
    await seedJefferson(prisma);

    const [types, projects, records, mentions] = await Promise.all([
      prisma.type.count(),
      prisma.project.count(),
      prisma.record.count(),
      prisma.mention.count(),
    ]);
    expect(types).toBe(16);
    expect(projects).toBe(6);
    expect(records).toBe(recordsJson.length + entitiesJson.length);
    expect(mentions).toBe(mentionsJson.length);
    expect(await prisma.record.count({ where: { creatorId: { not: null } } })).toBe(0);

    // The stored offsets read back exactly as the surface, as SQL sees them.
    const bad = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM lit_mention m JOIN lit_record r ON r.id = m."recordId"
      WHERE substring(r.text FROM m.start + 1 FOR m."end" - m.start) <> m.surface`;
    expect(Number(bad[0].n)).toBe(0);
  }, 60_000);

  it('deleting an entity cascades to its mentions', async () => {
    await seedJefferson(prisma);
    const m = await prisma.mention.findFirstOrThrow();
    const before = await prisma.mention.count();
    const n = await prisma.mention.count({ where: { entityId: m.entityId } });
    await prisma.projectRecord.deleteMany({ where: { recordId: m.entityId } });
    await prisma.record.delete({ where: { id: m.entityId } });
    expect(await prisma.mention.count()).toBe(before - n);
  }, 60_000);
});
