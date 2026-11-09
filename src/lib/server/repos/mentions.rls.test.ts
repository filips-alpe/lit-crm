import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma, prismaOwner } from '$lib/prisma';
import { runAs } from '$lib/server/db/context';
import { makeWorld, type World } from '$lib/server/db/rls.testutil';
import { updateRecord } from './records';
import { loadBestPageInput } from './bestPage';
import { buildBestPage } from '$lib/bestPage/assemble';

// Mentions exactly as the app runs them: scoped to a user, row-level security deciding.
//   S    = alice's record R1, text "See Eve and Bobby here."
//   eve  = a record alice created (she sees it)           S -> eve   (visible to alice)
//   R2   = bob's record (alice cannot see it)             S -> R2    (planted by the owner)
const TEXT = 'See Eve and Bobby here.';
let w: World;
let eve: { id: string };
beforeEach(async () => {
  vi.stubEnv('LIT_DB_OWNER_FALLBACK', '');
  w = await makeWorld();
  await prismaOwner.record.update({ where: { id: w.r1.id }, data: { text: TEXT } });
  eve = await prismaOwner.record.create({
    data: { typeId: w.type.id, creatorId: w.alice.id, title: 'Eve Entity' },
  });
  await prismaOwner.recordMention.createMany({
    data: [
      { sourceId: w.r1.id, entityId: eve.id, start: 4, end: 7 },
      { sourceId: w.r1.id, entityId: w.r2.id, start: 12, end: 17 },
    ],
  });
});
afterEach(() => vi.unstubAllEnvs());

const mentionCount = (userId: string | null) => runAs(userId, () => prisma.recordMention.count());

describe('mentions follow row-level security', () => {
  it('shows a mention only when both records it joins are visible', async () => {
    expect(await mentionCount(w.alice.id)).toBe(1); // R2 is not hers
    expect(await mentionCount(w.bob.id)).toBe(0); // bob cannot see the source
    expect(await mentionCount(w.dora.id)).toBe(0); // dora reads R2 only
    expect(await mentionCount(w.admin.id)).toBe(2);
    expect(await mentionCount(w.gone.id)).toBe(0);
    expect(await mentionCount(null)).toBe(0);
    const seen = await runAs(w.alice.id, () => prisma.recordMention.findMany());
    expect(seen.map((m) => m.entityId)).toEqual([eve.id]);
  });

  it('refuses to plant a mention of a record you cannot see, or from a record you cannot write', async () => {
    // alice writes R1 but cannot see R2
    await expect(
      runAs(w.alice.id, () =>
        prisma.recordMention.create({
          data: { sourceId: w.r1.id, entityId: w.r2.id, start: 0, end: 1 },
        }),
      ),
    ).rejects.toThrow();
    // dora reads R2 but may not write it, so it cannot be a source; R1 is invisible to her
    await expect(
      runAs(w.dora.id, () =>
        prisma.recordMention.create({
          data: { sourceId: w.r2.id, entityId: w.r2.id, start: 0, end: 1 },
        }),
      ),
    ).rejects.toThrow();
    // allowed: write on the source, read on the entity
    const ok = await runAs(w.alice.id, () =>
      prisma.recordMention.create({
        data: { sourceId: w.r1.id, entityId: eve.id, start: 8, end: 11 },
      }),
    );
    expect(ok.entityId).toBe(eve.id);
    expect(await prismaOwner.recordMention.count()).toBe(3);
  });

  it('deletes only mentions whose source is writable and entity readable; never updates', async () => {
    const del = await runAs(w.alice.id, () => prisma.recordMention.deleteMany());
    expect(del.count).toBe(1); // the mention of invisible R2 stays
    expect(await prismaOwner.recordMention.count()).toBe(1);
    expect(
      await runAs(w.bob.id, () => prisma.recordMention.deleteMany()).then((r) => r.count),
    ).toBe(0);
    await expect(
      runAs(w.admin.id, () => prisma.recordMention.updateMany({ data: { start: 1 } })),
    ).rejects.toThrow();
  });

  it('drops every mention of a record when its text is edited, the invisible ones too', async () => {
    await runAs(w.alice.id, () => updateRecord(w.r1.id, { text: 'Completely new text.' }));
    expect(await prismaOwner.recordMention.count()).toBe(0);
  });

  it('offers no callable function that deletes the mentions of a record the session cannot see', async () => {
    const mentionsOfR2 = () => prismaOwner.recordMention.count({ where: { entityId: w.r2.id } });
    expect(await mentionsOfR2()).toBe(1);
    // every void function of one text argument that the app role may execute, plus the old name
    const fns = await prismaOwner.$queryRaw<{ name: string }[]>`
      SELECT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prorettype = 'void'::regtype
        AND p.pronargs = 1 AND p.proargtypes[0] = 'text'::regtype
        AND has_function_privilege('lit_app', p.oid, 'EXECUTE')`;
    const names = [...new Set([...fns.map((f) => f.name), 'lit_drop_mentions'])];
    // the trigger function is not executable by the app role at all
    const guard = await prismaOwner.$queryRaw<{ ok: boolean }[]>`
      SELECT has_function_privilege('lit_app', 'lit_guard_mentions()', 'EXECUTE') AS ok`;
    expect(guard[0].ok).toBe(false);
    // alice sees neither R2 nor the source's other records' mentions of it; so does a user who sees nothing
    for (const user of [w.alice.id, w.gone.id]) {
      for (const name of names) {
        for (const target of [w.r2.id, w.r1.id]) {
          await runAs(user, () =>
            prisma.$executeRawUnsafe(`SELECT ${name}($1)`, target).catch(() => undefined),
          );
        }
      }
    }
    expect(await prismaOwner.recordMention.count()).toBe(2);
    expect(await mentionsOfR2()).toBe(1);
  });

  it('keeps a mention when the text is saved unchanged', async () => {
    await runAs(w.alice.id, () => updateRecord(w.r1.id, { text: TEXT }));
    expect(await prismaOwner.recordMention.count()).toBe(2);
  });

  it('cascades when a record is deleted, whatever mentions point at it', async () => {
    // alice may delete eve (she created it); the mention of eve goes with it
    await runAs(w.alice.id, () => prisma.record.delete({ where: { id: eve.id } }));
    expect(await prismaOwner.recordMention.count()).toBe(1);
  });
});

describe('the best page under row-level security', () => {
  it('a document shows names it cannot link as plain text, with no leak of the hidden record', async () => {
    const input = await runAs(w.alice.id, () => loadBestPageInput(w.r1.id));
    expect(input?.outgoing.map((m) => m.entityId)).toEqual([eve.id]);
    expect(input?.named.map((n) => n.id)).toEqual([eve.id]);
    const page = buildBestPage(input!);
    const text = page.sections.find((s) => s.kind === 'text');
    if (text?.kind !== 'text') throw new Error('no text');
    expect(text.segments.map((s) => s.text).join('')).toBe(TEXT);
    expect(text.segments.filter((s) => s.entityId).map((s) => s.entityId)).toEqual([eve.id]);
    const dump = JSON.stringify(page) + JSON.stringify(input);
    expect(dump).not.toContain(w.r2.id);
    expect(dump).not.toContain('R2');
  });

  it('an entity page lists only the sources and co-mentions the user may see', async () => {
    const asAlice = await runAs(w.alice.id, () => loadBestPageInput(eve.id));
    expect(asAlice?.incomingTotal).toBe(1);
    expect(asAlice?.incoming.map((m) => m.source.id)).toEqual([w.r1.id]);
    expect(asAlice?.related).toEqual([]); // R2 is mentioned with eve, but alice cannot see it
    expect(JSON.stringify(asAlice)).not.toContain(w.r2.id);
    // the admin sees the co-mentioned record
    const asAdmin = await runAs(w.admin.id, () => loadBestPageInput(eve.id));
    expect(asAdmin?.related.map((r) => r.id)).toEqual([w.r2.id]);
    // bob cannot see the source at all: no page content, and not eve's page either
    expect(await runAs(w.bob.id, () => loadBestPageInput(eve.id))).toBeNull();
  });

  it('a record the user cannot read has no page; an invisible parent is not linked', async () => {
    expect(await runAs(w.bob.id, () => loadBestPageInput(w.r1.id))).toBeNull();
    expect(await runAs(w.alice.id, () => loadBestPageInput(w.rh.id))).toBeNull();
    const child = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: w.alice.id, title: 'Child', recordId: w.r2.id },
    });
    const input = await runAs(w.alice.id, () => loadBestPageInput(child.id));
    expect(input?.record.record).toBeNull();
    // the parent's page lists its children only to those who see them
    const parent = await runAs(w.bob.id, () => loadBestPageInput(w.r2.id));
    expect(parent?.children).toEqual([]);
  });

  it('keeps amounts masked: no amount reaches the page of someone whose path hides them', async () => {
    const asDora = await runAs(w.dora.id, () => loadBestPageInput(w.r2.id));
    expect(asDora?.record.id).toBe(w.r2.id);
    const page = JSON.stringify(buildBestPage(asDora!));
    expect(page).not.toMatch(/\b50\b|\b55\b/);
    const asAlice = await runAs(w.alice.id, () => loadBestPageInput(w.r1.id));
    expect(JSON.stringify(buildBestPage(asAlice!))).not.toMatch(/\b100\b|\b120\b/);
  });
});
