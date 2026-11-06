import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { addType } from '$lib/server/repos/types';
import { createRecord } from '$lib/server/repos/records';
import { loadBestPageInput } from './bestPage';
import { buildBestPage } from '$lib/bestPage/assemble';

const docLayout = {
  fields: [
    { id: 'title', label: 'Title', kind: 'text' as const, writeTo: 'title' },
    { id: 'from', label: 'Author', kind: 'text' as const, writeTo: 'from' },
    { id: 'body', label: 'Text', kind: 'text' as const, writeTo: 'text' },
  ],
};
const entityLayout = {
  fields: [
    { id: 'title', label: 'Name', kind: 'text' as const, writeTo: 'title' },
    { id: 'description', label: 'Description', kind: 'text' as const, writeTo: 'description' },
  ],
};

async function fixture() {
  const docType = await addType({ code: 'memorandum', layout: docLayout });
  const personType = await addType({ code: 'person', layout: entityLayout });
  const text1 = 'Th: Jefferson mentioned to him a letter from Hamilton about Knox.';
  const text2 = 'Hamilton dined with the President.';
  const doc1 = await createRecord({ typeId: docType.id });
  const doc2 = await createRecord({ typeId: docType.id });
  await prisma.record.update({
    where: { id: doc1.id },
    data: { title: 'Anas 1', text: text1, from: 'Thomas Jefferson' },
  });
  await prisma.record.update({ where: { id: doc2.id }, data: { title: 'Anas 2', text: text2 } });
  const hamilton = await createRecord({ typeId: personType.id });
  const knox = await createRecord({ typeId: personType.id });
  await prisma.record.update({
    where: { id: hamilton.id },
    data: { title: 'Alexander Hamilton', description: 'Secretary of the Treasury' },
  });
  await prisma.record.update({ where: { id: knox.id }, data: { title: 'Henry Knox' } });
  const at = (t: string, s: string) => ({ start: t.indexOf(s), end: t.indexOf(s) + s.length });
  await prisma.recordMention.createMany({
    data: [
      { sourceId: doc1.id, entityId: hamilton.id, ...at(text1, 'Hamilton') },
      { sourceId: doc1.id, entityId: knox.id, ...at(text1, 'Knox') },
      { sourceId: doc2.id, entityId: hamilton.id, ...at(text2, 'Hamilton') },
    ],
  });
  return { doc1, doc2, hamilton, knox };
}

describe('loadBestPageInput', () => {
  it('returns null for an unknown record', async () => {
    expect(await loadBestPageInput('nope')).toBeNull();
  });

  it('gives an entity its mentions in context and the entities mentioned with it', async () => {
    const { hamilton, knox, doc1 } = await fixture();
    const input = await loadBestPageInput(hamilton.id);
    expect(input?.incomingTotal).toBe(2);
    expect(input?.incoming.map((m) => m.source.title)).toEqual(['Anas 1', 'Anas 2']);
    expect(input?.related.map((r) => [r.id, r.count])).toEqual([[knox.id, 1]]);

    const page = buildBestPage(input!);
    expect(page.sections.map((s) => s.kind)).toEqual(['facts', 'mentions', 'related']);
    const mentions = page.sections.find((s) => s.kind === 'mentions');
    if (mentions?.kind !== 'mentions') throw new Error('no mentions');
    const first = mentions.groups.find((g) => g.source.id === doc1.id)!.contexts[0];
    expect(first.match).toBe('Hamilton');
    expect(`${first.before}${first.match}${first.after}`).toBe(
      'Th: Jefferson mentioned to him a letter from Hamilton about Knox.',
    );
  });

  it('gives a document its linked text and the names in it', async () => {
    const { doc1, hamilton, knox } = await fixture();
    const page = buildBestPage((await loadBestPageInput(doc1.id))!);
    expect(page.sections.map((s) => s.kind)).toEqual(['facts', 'text', 'mentioned']);
    const text = page.sections.find((s) => s.kind === 'text');
    if (text?.kind !== 'text') throw new Error('no text');
    expect(text.segments.map((s) => s.text).join('')).toBe(
      'Th: Jefferson mentioned to him a letter from Hamilton about Knox.',
    );
    expect(text.segments.filter((s) => s.entityId).map((s) => [s.text, s.entityId])).toEqual([
      ['Hamilton', hamilton.id],
      ['Knox', knox.id],
    ]);
  });

  it('removes mentions with their record', async () => {
    const { doc2 } = await fixture();
    await prisma.record.delete({ where: { id: doc2.id } });
    expect(await prisma.recordMention.count()).toBe(2);
  });
});
