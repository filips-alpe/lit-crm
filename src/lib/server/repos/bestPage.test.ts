import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { getBestPage, MENTIONS_PAGE_SIZE } from './bestPage';

const ENTITY_LAYOUT = {
  fields: [
    { id: 'title', label: 'Name', kind: 'text', writeTo: 'title' },
    { id: 'note', label: 'Note', kind: 'text', writeTo: 'note' },
    { id: 'refs', label: 'Sources', kind: 'list', writeTo: 'references' },
  ],
};
const SOURCE_LAYOUT = {
  fields: [
    { id: 'title', label: 'Title', kind: 'text', writeTo: 'title' },
    { id: 'body', label: 'Text', kind: 'markdown', writeTo: 'text' },
    { id: 'refs', label: 'Sources', kind: 'list', writeTo: 'references' },
  ],
};

async function world() {
  const person = await prisma.type.create({
    data: { code: 'person', color: '#e07a1f', iconSeed: 'p', layout: ENTITY_LAYOUT },
  });
  const place = await prisma.type.create({ data: { code: 'place', layout: ENTITY_LAYOUT } });
  const letter = await prisma.type.create({ data: { code: 'doc', layout: SOURCE_LAYOUT } });
  const project = await prisma.project.create({ data: { code: 'p1' } });

  const mk = async (id: string, typeId: string, data: Record<string, unknown>, ms: number) => {
    const r = await prisma.record.create({
      data: { id, typeId, createdAt: new Date(1_000_000 + ms), ...data },
    });
    await prisma.projectRecord.create({ data: { projectId: project.id, recordId: id } });
    return r;
  };

  await mk('e-jef', person.id, { title: 'Thomas Jefferson', references: ['IA: x'] }, 1);
  await mk('e-mad', person.id, { title: 'James Madison', note: 'a note' }, 2);
  await mk('e-par', place.id, { title: 'Paris' }, 3);
  await mk('e-none', place.id, { title: 'Nowhere' }, 4);
  const t1 = 'Mr. Jefferson wrote to Madison from Paris. Jefferson again.';
  const t2 = 'Madison and Jefferson met.';
  await mk('d1', letter.id, { title: 'First', text: t1, references: ['loc 1'] }, 10);
  await mk('d2', letter.id, { title: 'Second', text: t2 }, 11);
  await mk('d3', letter.id, { title: 'Third', text: 'nothing here' }, 12);

  const at = (t: string, s: string, from = 0) => {
    const i = t.indexOf(s, from);
    return { start: i, end: i + s.length, surface: s };
  };
  const men = [
    { recordId: 'd1', entityId: 'e-jef', ...at(t1, 'Jefferson') },
    { recordId: 'd1', entityId: 'e-mad', ...at(t1, 'Madison') },
    { recordId: 'd1', entityId: 'e-par', ...at(t1, 'Paris') },
    { recordId: 'd1', entityId: 'e-jef', ...at(t1, 'Jefferson', 12) },
    { recordId: 'd2', entityId: 'e-mad', ...at(t2, 'Madison') },
    { recordId: 'd2', entityId: 'e-jef', ...at(t2, 'Jefferson') },
  ];
  await prisma.mention.createMany({ data: men.map((m, i) => ({ id: `m${i}`, ...m })) });
  return { t1, t2 };
}

describe('getBestPage', () => {
  it('returns null for an unknown id', async () => {
    expect(await getBestPage('nope')).toBeNull();
  });

  it('assembles an entity page from the data alone', async () => {
    await world();
    const p = (await getBestPage('e-jef'))!;
    expect(p.id).toBe('e-jef');
    expect(p.title).toBe('Thomas Jefferson');
    expect(p.type).toEqual({ code: 'person', color: '#e07a1f', iconSeed: 'p' });
    // only non-empty layout fields, with labels
    expect(p.fields).toEqual([
      { id: 'title', label: 'Name', kind: 'text', value: 'Thomas Jefferson' },
      { id: 'refs', label: 'Sources', kind: 'list', value: ['IA: x'] },
    ]);
    expect(p.references).toEqual(['IA: x']);
    expect(p.variants).toEqual([{ surface: 'Jefferson', count: 3 }]);
    expect(p.sources.map((s) => [s.id, s.count])).toEqual([
      ['d1', 2],
      ['d2', 1],
    ]);
    expect(p.related.map((r) => [r.id, r.count])).toEqual([
      ['e-mad', 2],
      ['e-par', 1],
    ]);
    expect(p.mentionedEntities).toEqual([]);
    expect(p.mentions.total).toBe(3);
    expect(p.mentions.items[0]).toMatchObject({
      recordId: 'd1',
      recordTitle: 'First',
      surface: 'Jefferson',
      before: 'Mr. ',
      after: ' wrote to Madison from Paris. Jefferson again.',
    });
  });

  it('snippets are cut by SQL around the offsets, not whole texts', async () => {
    const letter = await prisma.type.create({ data: { code: 'big', layout: SOURCE_LAYOUT } });
    const ent = await prisma.type.create({ data: { code: 'ent', layout: ENTITY_LAYOUT } });
    const text = `${'a'.repeat(5000)}Zed${'b'.repeat(5000)}`;
    await prisma.record.create({ data: { id: 'big1', typeId: letter.id, title: 'B', text } });
    await prisma.record.create({ data: { id: 'ez', typeId: ent.id, title: 'Zed' } });
    await prisma.mention.create({
      data: { recordId: 'big1', entityId: 'ez', start: 5000, end: 5003, surface: 'Zed' },
    });
    const p = (await getBestPage('ez'))!;
    expect(p.mentions.items[0].before).toBe('a'.repeat(80));
    expect(p.mentions.items[0].after).toBe('b'.repeat(80));
    expect(JSON.stringify(p).length).toBeLessThan(5000);
  });

  it('assembles a source record page: entities it mentions, no mention contexts', async () => {
    await world();
    const p = (await getBestPage('d1'))!;
    expect(p.mentionedEntities.map((e) => [e.id, e.count])).toEqual([
      ['e-jef', 2],
      ['e-mad', 1],
      ['e-par', 1],
    ]);
    expect(p.mentions.total).toBe(0);
    expect(p.variants).toEqual([]);
    expect(p.sources).toEqual([]);
    // long-form text is not part of the best page
    expect(p.fields.map((f) => f.id)).toEqual(['title', 'refs']);
    expect(JSON.stringify(p)).not.toContain('wrote to Madison');
  });

  it('an entity with no mentions has empty collections', async () => {
    await world();
    const p = (await getBestPage('e-none'))!;
    expect(p.variants).toEqual([]);
    expect(p.sources).toEqual([]);
    expect(p.related).toEqual([]);
    expect(p.mentions).toMatchObject({ total: 0, items: [], page: 1, totalPages: 1 });
  });

  it('skips a mention whose recorded surface no longer matches the text', async () => {
    await world();
    await prisma.record.update({
      where: { id: 'd2' },
      data: { text: 'Madison and Xefferson met.' },
    });
    const p = (await getBestPage('e-jef'))!;
    expect(p.mentions.total).toBe(2);
    expect(p.sources.map((s) => s.id)).toEqual(['d1']);
    expect(p.variants).toEqual([{ surface: 'Jefferson', count: 2 }]);
  });

  it('variants count distinct surfaces', async () => {
    await world();
    await prisma.record.update({
      where: { id: 'd2' },
      data: { text: 'Madison and Mr. Jeff met.' },
    });
    await prisma.mention.update({
      where: { id: 'm5' },
      data: { start: 16, end: 20, surface: 'Jeff' },
    });
    const p = (await getBestPage('e-jef'))!;
    expect(p.variants).toEqual([
      { surface: 'Jefferson', count: 2 },
      { surface: 'Jeff', count: 1 },
    ]);
  });

  it('paginates mention contexts 50 per page and clamps the page', async () => {
    const letter = await prisma.type.create({ data: { code: 'doc', layout: SOURCE_LAYOUT } });
    const ent = await prisma.type.create({ data: { code: 'ent', layout: ENTITY_LAYOUT } });
    await prisma.record.create({ data: { id: 'ent1', typeId: ent.id, title: 'E' } });
    const text = 'x E y '.repeat(120);
    await prisma.record.create({ data: { id: 's1', typeId: letter.id, title: 'S', text } });
    await prisma.mention.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        id: `pm${String(i).padStart(3, '0')}`,
        recordId: 's1',
        entityId: 'ent1',
        start: i * 6 + 2,
        end: i * 6 + 3,
        surface: 'E',
      })),
    });
    expect(MENTIONS_PAGE_SIZE).toBe(50);
    const p1 = (await getBestPage('ent1'))!;
    expect(p1.mentions).toMatchObject({ page: 1, total: 120, totalPages: 3, pageSize: 50 });
    expect(p1.mentions.items).toHaveLength(50);
    const p3 = (await getBestPage('ent1', { page: 3 }))!;
    expect(p3.mentions.items).toHaveLength(20);
    expect(p3.mentions.items[0].start).toBe(100 * 6 + 2);
    const p9 = (await getBestPage('ent1', { page: 9 }))!;
    expect(p9.mentions.page).toBe(3);
    const p0 = (await getBestPage('ent1', { page: -4 }))!;
    expect(p0.mentions.page).toBe(1);
  });

  it('related entities are capped at 20, most co-mentions first', async () => {
    const ent = await prisma.type.create({ data: { code: 'ent', layout: ENTITY_LAYOUT } });
    const src = await prisma.type.create({ data: { code: 'doc', layout: SOURCE_LAYOUT } });
    await prisma.record.create({ data: { id: 'main', typeId: ent.id, title: 'Main' } });
    for (let i = 0; i < 25; i++)
      await prisma.record.create({
        data: { id: `o${i}`, typeId: ent.id, title: `O${String(i).padStart(2, '0')}` },
      });
    await prisma.record.create({
      data: { id: 'src', typeId: src.id, title: 'S', text: 'M ' + 'o '.repeat(25) },
    });
    const ms = [
      { e: 'main', s: 0 },
      ...Array.from({ length: 25 }, (_, i) => ({ e: `o${i}`, s: 2 + i * 2 })),
    ];
    await prisma.mention.createMany({
      data: ms.map((m, i) => ({
        id: `r${i}`,
        recordId: 'src',
        entityId: m.e,
        start: m.s,
        end: m.s + 1,
        surface: m.e === 'main' ? 'M' : 'o',
      })),
    });
    const p = (await getBestPage('main'))!;
    expect(p.related).toHaveLength(20);
    // equal counts: ordered by title
    expect(p.related[0].title).toBe('O00');
  });

  it('gives the sequence neighbours within the first project, in createdAt order', async () => {
    await world();
    const mid = (await getBestPage('e-mad'))!;
    expect(mid.sequence).toMatchObject({
      position: 2,
      total: 7,
      prev: { id: 'e-jef', title: 'Thomas Jefferson' },
      next: { id: 'e-par', title: 'Paris' },
    });
    const first = (await getBestPage('e-jef'))!;
    expect(first.sequence!.prev).toBeNull();
    const last = (await getBestPage('d3'))!;
    expect(last.sequence!.next).toBeNull();
    expect(last.sequence!.position).toBe(7);
  });

  it('has no sequence for a record outside any project', async () => {
    const t = await prisma.type.create({ data: { code: 'loose', layout: ENTITY_LAYOUT } });
    await prisma.record.create({ data: { id: 'loose1', typeId: t.id, title: 'L' } });
    const p = (await getBestPage('loose1'))!;
    expect(p.sequence).toBeNull();
  });
});
