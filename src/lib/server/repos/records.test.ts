import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import {
  createRecord,
  getCorrespondenceNeighbors,
  InvalidDateError,
  getRecordById,
  listCorrespondenceMap,
  resolveRecordOptions,
  searchRecordOptions,
  listRecords,
  updateRecord,
  validateRecordRelations,
} from './records';
import { addType } from './types';

describe('records repo', () => {
  it('createRecord persists a row linked to the given type', async () => {
    const type = await addType({ code: 'T1' });
    const row = await createRecord({ typeId: type.id, note: 'first' });
    expect(row.typeId).toBe(type.id);
    expect(row.note).toBe('first');
    expect(row.status).toBe('ACTIVE');
  });

  it('rejects an unparseable date with a typed error on create and update', async () => {
    const type = await addType({ code: 'BADD' });
    await expect(createRecord({ typeId: type.id, date: 'not-a-date' })).rejects.toBeInstanceOf(
      InvalidDateError,
    );
    const ok = await createRecord({ typeId: type.id, note: 'ok' });
    await expect(updateRecord(ok.id, { start: 'nope' })).rejects.toMatchObject({
      name: 'InvalidDateError',
      column: 'start',
    });
    expect((await listRecords()).total).toBe(1);
  });

  it('persists and clears start/end, the other date-kind columns', async () => {
    const type = await addType({ code: 'SE1' });
    const created = await createRecord({
      typeId: type.id,
      start: '2026-03-01T09:30:00Z',
      end: '2026-03-01T11:00:00Z',
    });
    expect(created.start?.toISOString()).toBe('2026-03-01T09:30:00.000Z');
    expect(created.end?.toISOString()).toBe('2026-03-01T11:00:00.000Z');
    const updated = await updateRecord(created.id, { start: '2026-04-02T08:00:00Z', end: null });
    expect(updated.start?.toISOString()).toBe('2026-04-02T08:00:00.000Z');
    expect(updated.end).toBeNull();
  });

  it('returns Decimal sum/total as serializable plain numbers', async () => {
    const type = await addType({ code: 'DEC1' });
    const created = await createRecord({
      typeId: type.id,
      note: 'priced',
      sum: 12.5,
      total: 99.99,
    });
    expect(typeof created.sum).toBe('number');
    expect(created.sum).toBe(12.5);
    expect(typeof created.total).toBe('number');
    // POJO check: a Decimal instance would throw here.
    expect(() => structuredClone(created)).not.toThrow();

    const listed = (await listRecords()).rows.find((r) => r.id === created.id);
    expect(typeof listed?.sum).toBe('number');
    expect(listed?.total).toBe(99.99);
  });

  it('listRecords filters by correspondent against each type’s recipient column', async () => {
    // Letter type: recipient is `to`. Payment type: recipient is `from`.
    const letterType = await addType({
      code: 'LET1',
      layout: { fields: [{ id: 'to', label: 'To', kind: 'text', writeTo: 'to' }] },
    });
    const paymentType = await addType({
      code: 'PAY1',
      layout: { fields: [{ id: 'from', label: 'Received from', kind: 'text', writeTo: 'from' }] },
    });

    const letterTo = await createRecord({ typeId: letterType.id, note: 'letter-to' });
    const letterFrom = await createRecord({ typeId: letterType.id, note: 'letter-from' });
    const payment = await createRecord({ typeId: paymentType.id, note: 'payment' });
    const otherLetter = await createRecord({ typeId: letterType.id, note: 'other' });
    await prisma.record.update({ where: { id: letterTo.id }, data: { to: 'D. Hume, Edinburgh' } });
    // A letter's sender (`from`) is NOT the recipient column, so this must not match.
    await prisma.record.update({ where: { id: letterFrom.id }, data: { from: 'David Hume' } });
    await prisma.record.update({ where: { id: payment.id }, data: { from: 'David Hume' } });
    await prisma.record.update({ where: { id: otherLetter.id }, data: { to: 'Voltaire' } });

    const result = await listRecords({ correspondent: 'hume' });
    expect(result.total).toBe(2);
    expect(result.rows.map((r) => r.note).sort()).toEqual(['letter-to', 'payment']);
  });

  it('listRecords returns rows and total count for page 1', async () => {
    const type = await addType({ code: 'P1' });
    await createRecord({ typeId: type.id, note: 'a' });
    await createRecord({ typeId: type.id, note: 'b' });
    const result = await listRecords({ page: 1 });
    expect(result.total).toBe(2);
    expect(result.rows.map((r) => r.note).sort()).toEqual(['a', 'b']);
  });

  it('listRecords sorts by entry time in both directions, ties broken by id', async () => {
    const type = await addType({ code: 'S1' });
    const mk = async (note: string, iso: string) => {
      const r = await createRecord({ typeId: type.id, note });
      await prisma.record.update({ where: { id: r.id }, data: { createdAt: new Date(iso) } });
    };
    // Insert newest first so insertion order is the inverse of entry order.
    await mk('new', '2026-05-01T00:00:00Z');
    await mk('old', '2026-01-01T00:00:00Z');
    const desc = await listRecords();
    expect(desc.rows.map((r) => r.note)).toEqual(['new', 'old']);
    const asc = await listRecords({ sortDir: 'asc' });
    expect(asc.rows.map((r) => r.note)).toEqual(['old', 'new']);
  });

  it('listRecords hides INACTIVE rows by default', async () => {
    const type = await addType({ code: 'H1' });
    const kept = await createRecord({ typeId: type.id, note: 'keep' });
    const gone = await createRecord({ typeId: type.id, note: 'gone' });
    await prisma.record.update({ where: { id: gone.id }, data: { status: 'INACTIVE' } });
    const result = await listRecords();
    expect(result.total).toBe(1);
    expect(result.rows[0].id).toBe(kept.id);
  });

  it('listRecords with includeDeleted=true shows INACTIVE rows too', async () => {
    const type = await addType({ code: 'H2' });
    await createRecord({ typeId: type.id, note: 'live' });
    const gone = await createRecord({ typeId: type.id, note: 'dead' });
    await prisma.record.update({ where: { id: gone.id }, data: { status: 'INACTIVE' } });
    const result = await listRecords({ includeDeleted: true });
    expect(result.total).toBe(2);
  });

  it('listRecords includes the creator when a record has one, null otherwise', async () => {
    const type = await addType({ code: 'CR1' });
    const user = await prisma.user.create({
      data: { username: `cr-${Date.now()}-${Math.random()}`, name: 'Tester' },
    });
    const owned = await createRecord({ typeId: type.id, note: 'owned', creatorId: user.id });
    const orphan = await createRecord({ typeId: type.id, note: 'orphan' });

    const rows = (await listRecords({ includeDeleted: true })).rows;
    const ownedRow = rows.find((r) => r.id === owned.id);
    const orphanRow = rows.find((r) => r.id === orphan.id);

    expect(ownedRow?.creator).toMatchObject({
      id: user.id,
      username: user.username,
      name: 'Tester',
    });
    expect(orphanRow?.creator).toBeNull();
  });

  it('createRecord persists assignee and linked-record relation ids', async () => {
    const type = await addType({ code: 'REL1' });
    const assignee = await prisma.user.create({
      data: { username: `as-${Date.now()}-${Math.random()}`, name: 'Assignee' },
    });
    const target = await createRecord({ typeId: type.id, note: 'target' });

    const row = await createRecord({
      typeId: type.id,
      note: 'linked',
      assigneeId: assignee.id,
      recordId: target.id,
    });

    expect(row.assigneeId).toBe(assignee.id);
    expect(row.recordId).toBe(target.id);
  });
});

describe('record ↔ project links', () => {
  async function project(code: string, color?: string) {
    return prisma.project.create({
      data: { code: `${code}-${Date.now()}-${Math.random()}`, ...(color ? { color } : {}) },
    });
  }

  it('createRecord links the given projects via the join', async () => {
    const type = await addType({ code: 'PJ1' });
    const p1 = await project('p1');
    const p2 = await project('p2');
    const rec = await createRecord({ typeId: type.id, note: 'x', projectIds: [p1.id, p2.id] });
    const links = await prisma.projectRecord.findMany({ where: { recordId: rec.id } });
    expect(links.map((l) => l.projectId).sort()).toEqual([p1.id, p2.id].sort());
  });

  it('updateRecord replaces the record’s project set', async () => {
    const type = await addType({ code: 'PJ2' });
    const p1 = await project('q1');
    const p2 = await project('q2');
    const p3 = await project('q3');
    const rec = await createRecord({ typeId: type.id, note: 'x', projectIds: [p1.id, p2.id] });
    await updateRecord(rec.id, { projectIds: [p3.id] });
    const links = await prisma.projectRecord.findMany({ where: { recordId: rec.id } });
    expect(links.map((l) => l.projectId)).toEqual([p3.id]);
  });

  it('getRecordById includes the linked projects (id/code/color)', async () => {
    const type = await addType({ code: 'PJ3' });
    const p1 = await project('r1', '#abcdef');
    const rec = await createRecord({ typeId: type.id, note: 'x', projectIds: [p1.id] });
    const row = await getRecordById(rec.id);
    expect(row?.projects).toEqual([
      { projectId: p1.id, project: { id: p1.id, code: p1.code, color: '#abcdef' } },
    ]);
  });
});

describe('searchRecordOptions', () => {
  it('returns active records as id/label, excluding a given id and inactive rows', async () => {
    const type = await addType({ code: 'RO1' });
    const a = await createRecord({ typeId: type.id, note: 'note A' });
    await prisma.record.update({ where: { id: a.id }, data: { title: 'Title A' } });
    const b = await createRecord({ typeId: type.id, note: 'note B' });
    const dead = await createRecord({ typeId: type.id, note: 'gone' });
    await prisma.record.update({ where: { id: dead.id }, data: { status: 'INACTIVE' } });

    const opts = await searchRecordOptions({ excludeId: b.id });
    const ids = opts.map((o) => o.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
    expect(ids).not.toContain(dead.id);
    // Label prefers the title, falling back to the note.
    expect(opts.find((o) => o.id === a.id)?.label).toBe('Title A');
  });

  it('filters by title or note case-insensitively, caps results and truncates long labels', async () => {
    const type = await addType({ code: 'RO2' });
    const t = await createRecord({ typeId: type.id, note: 'plain' });
    await prisma.record.update({ where: { id: t.id }, data: { title: 'Zebra Crossing' } });
    const n = await createRecord({ typeId: type.id, note: 'a zebra note' });
    await createRecord({ typeId: type.id, note: 'unrelated' });
    const long = await createRecord({ typeId: type.id, note: 'x'.repeat(500) });

    const hits = await searchRecordOptions({ q: 'ZEBRA' });
    expect(hits.map((o) => o.id).sort()).toEqual([t.id, n.id].sort());

    expect(await searchRecordOptions({ limit: 2 })).toHaveLength(2);

    const [longOpt] = await searchRecordOptions({ q: 'xxxx' });
    expect(longOpt.id).toBe(long.id);
    expect(longOpt.label.length).toBeLessThanOrEqual(121);
  });
});

describe('searchRecordOptions untitled records', () => {
  it('labels a record without title or note as "<type code> · <date>" and finds it by type code or text', async () => {
    const type = await addType({ code: 'UNTITLEDQ' });
    const bare = await createRecord({ typeId: type.id });
    await prisma.record.update({
      where: { id: bare.id },
      data: { date: new Date('2026-03-04T00:00:00Z') },
    });
    const withText = await createRecord({ typeId: type.id });
    await prisma.record.update({ where: { id: withText.id }, data: { text: 'quokka body' } });

    const byCode = await searchRecordOptions({ q: 'untitledq' });
    expect(byCode.find((o) => o.id === bare.id)?.label).toBe('UNTITLEDQ · 2026-03-04');
    const bareCreated = (await prisma.record.findUnique({ where: { id: withText.id } }))!.createdAt;
    expect(byCode.find((o) => o.id === withText.id)?.label).toBe(
      `UNTITLEDQ · ${bareCreated.toISOString().slice(0, 10)}`,
    );

    const byText = await searchRecordOptions({ q: 'quokka' });
    expect(byText.map((o) => o.id)).toEqual([withText.id]);
    // Too short to scan the unindexed body text.
    const short = await searchRecordOptions({ q: 'qu' });
    expect(short.map((o) => o.id)).not.toContain(withText.id);
  });
});

describe('resolveRecordOptions', () => {
  it('labels exactly the requested ids, even inactive ones', async () => {
    const type = await addType({ code: 'RO3' });
    const a = await createRecord({ typeId: type.id, note: 'keep' });
    const dead = await createRecord({ typeId: type.id, note: 'old' });
    await prisma.record.update({ where: { id: dead.id }, data: { status: 'INACTIVE' } });
    await createRecord({ typeId: type.id, note: 'other' });

    const opts = await resolveRecordOptions([a.id, dead.id]);
    expect(opts.map((o) => o.id).sort()).toEqual([a.id, dead.id].sort());
    expect(await resolveRecordOptions([])).toEqual([]);
  });
});

describe('getRecordById', () => {
  it('returns the record with its type and creator, Decimals as plain numbers', async () => {
    const type = await addType({ code: 'G1' });
    const user = await prisma.user.create({
      data: { username: `g-${Date.now()}-${Math.random()}`, name: 'Reader' },
    });
    const created = await createRecord({
      typeId: type.id,
      note: 'fetch me',
      sum: 5.5,
      creatorId: user.id,
    });

    const row = await getRecordById(created.id);
    expect(row?.id).toBe(created.id);
    expect(row?.note).toBe('fetch me');
    expect(typeof row?.sum).toBe('number');
    expect(row?.type).toMatchObject({ id: type.id, code: 'G1' });
    expect(row?.creator).toMatchObject({ username: user.username, name: 'Reader' });
    expect(() => structuredClone(row)).not.toThrow();
  });

  it('returns null for an unknown id', async () => {
    expect(await getRecordById('does-not-exist')).toBeNull();
  });
});

describe('updateRecord', () => {
  it('writes only the provided columns and leaves the rest intact', async () => {
    const type = await addType({ code: 'U1' });
    const created = await createRecord({ typeId: type.id, note: 'before', sum: 1 });

    const updated = await updateRecord(created.id, { note: 'after', title: 'Hi' });
    expect(updated.note).toBe('after');
    expect(updated.title).toBe('Hi');
    // Untouched column keeps its original value.
    expect(updated.sum).toBe(1);
    expect(typeof updated.sum).toBe('number');
  });

  it('coerces a date string to a Date', async () => {
    const type = await addType({ code: 'U2' });
    const created = await createRecord({ typeId: type.id, note: 'd' });
    const updated = await updateRecord(created.id, { date: '2026-03-04T00:00:00Z' });
    expect(updated.date?.toISOString()).toBe('2026-03-04T00:00:00.000Z');
  });

  it('updates relation ids (creator, assignee, linked record) and can clear them', async () => {
    const type = await addType({ code: 'U3' });
    const creator = await prisma.user.create({
      data: { username: `uc-${Date.now()}-${Math.random()}`, name: 'Creator' },
    });
    const assignee = await prisma.user.create({
      data: { username: `ua-${Date.now()}-${Math.random()}`, name: 'Assignee' },
    });
    const target = await createRecord({ typeId: type.id, note: 'target' });
    const created = await createRecord({ typeId: type.id, note: 'rel' });

    const linked = await updateRecord(created.id, {
      creatorId: creator.id,
      assigneeId: assignee.id,
      recordId: target.id,
    });
    expect(linked.creatorId).toBe(creator.id);
    expect(linked.assigneeId).toBe(assignee.id);
    expect(linked.recordId).toBe(target.id);

    const cleared = await updateRecord(created.id, { assigneeId: null, recordId: null });
    expect(cleared.assigneeId).toBeNull();
    expect(cleared.recordId).toBeNull();
  });
});

describe('record column allowlist', () => {
  it('createRecord/updateRecord ignore non-writable keys smuggled into the input', async () => {
    const type = await addType({ code: 'ALLOW' });
    const created = await createRecord({
      typeId: type.id,
      note: 'ok',
      status: 'INACTIVE',
      id: 'forged-id',
      createdAt: new Date('2000-01-01'),
    } as never);
    expect(created.note).toBe('ok');
    expect(created.status).toBe('ACTIVE');
    expect(created.id).not.toBe('forged-id');
    expect(created.createdAt.getFullYear()).toBeGreaterThan(2020);

    const updated = await updateRecord(created.id, {
      title: 'T',
      status: 'INACTIVE',
      typeId: 'other',
    } as never);
    expect(updated.title).toBe('T');
    expect(updated.status).toBe('ACTIVE');
    expect(updated.typeId).toBe(type.id);
  });
});

describe('projectIds validation', () => {
  it('flags unknown and inactive projects, accepts active ones (duplicates ignored)', async () => {
    const ok = await prisma.project.create({ data: { code: `pv-${Date.now()}-a` } });
    const off = await prisma.project.create({
      data: { code: `pv-${Date.now()}-b`, status: 'INACTIVE' },
    });
    expect(await validateRecordRelations({ projectIds: [ok.id, ok.id] })).toBeNull();
    expect(await validateRecordRelations({ projectIds: [ok.id, 'nope'] })).toEqual({
      projectIds: 'notFound',
    });
    expect(await validateRecordRelations({ projectIds: [off.id] })).toEqual({
      projectIds: 'notFound',
    });
  });

  it('createRecord with duplicate project ids links each project once', async () => {
    const type = await addType({ code: 'PDUP' });
    const p = await prisma.project.create({ data: { code: `pd-${Date.now()}` } });
    const rec = await createRecord({ typeId: type.id, projectIds: [p.id, p.id] });
    expect((await getRecordById(rec.id))?.projects).toHaveLength(1);
  });
});

describe('getCorrespondenceNeighbors', () => {
  // createRecord doesn't take from/to; set them (and createdAt) directly.
  async function letter(typeId: string, from: string, to: string, iso: string) {
    const r = await createRecord({ typeId, note: `${from}->${to}` });
    await prisma.record.update({
      where: { id: r.id },
      data: { from, to, createdAt: new Date(iso) },
    });
    return r;
  }

  it('threads letters sharing the unordered from/to pair, in entry order', async () => {
    const type = await addType({ code: 'TH1' });
    // Franklin <-> Collinson, both directions, plus an unrelated letter.
    const l1 = await letter(type.id, 'Franklin', 'Collinson', '2026-01-01T00:00:00Z');
    const l2 = await letter(type.id, 'Collinson', 'Franklin', '2026-02-01T00:00:00Z');
    const l3 = await letter(type.id, 'Franklin', 'Collinson', '2026-03-01T00:00:00Z');
    await letter(type.id, 'Franklin', 'Hume', '2026-02-15T00:00:00Z');

    const mid = await getCorrespondenceNeighbors({
      id: l2.id,
      from: 'Collinson',
      to: 'Franklin',
      typeId: type.id,
    });
    expect(mid).toEqual({ prevId: l1.id, nextId: l3.id, position: 2, total: 3 });
  });

  it('matches endpoints trimmed and case-insensitively', async () => {
    const type = await addType({ code: 'TH2' });
    const l1 = await letter(type.id, 'Franklin', 'Collinson', '2026-01-01T00:00:00Z');
    const l2 = await letter(type.id, '  franklin ', 'COLLINSON', '2026-02-01T00:00:00Z');

    const n = await getCorrespondenceNeighbors({
      id: l1.id,
      from: 'Franklin',
      to: 'Collinson',
      typeId: type.id,
    });
    expect(n).toEqual({ prevId: null, nextId: l2.id, position: 1, total: 2 });
  });

  it('trims Unicode whitespace (NBSP etc.) on both sides, so a record matches its own thread', async () => {
    const type = await addType({ code: 'TH2U' });
    const l1 = await letter(type.id, 'Franklin\u00a0', '\u2003Collinson', '2026-01-01T00:00:00Z');
    const l2 = await letter(type.id, 'Collinson\u3000', 'Franklin', '2026-02-01T00:00:00Z');

    // Endpoints as the caller would pass them: JS-trimmed or not, both resolve.
    for (const [from, to] of [
      ['Franklin\u00a0', '\u2003Collinson'],
      ['Franklin', 'Collinson'],
    ]) {
      expect(await getCorrespondenceNeighbors({ id: l1.id, from, to, typeId: type.id })).toEqual({
        prevId: null,
        nextId: l2.id,
        position: 1,
        total: 2,
      });
    }
  });

  it('yields null prev/next at the ends of the thread', async () => {
    const type = await addType({ code: 'TH3' });
    const l1 = await letter(type.id, 'A', 'B', '2026-01-01T00:00:00Z');
    const l2 = await letter(type.id, 'A', 'B', '2026-02-01T00:00:00Z');

    expect(
      await getCorrespondenceNeighbors({ id: l1.id, from: 'A', to: 'B', typeId: type.id }),
    ).toEqual({ prevId: null, nextId: l2.id, position: 1, total: 2 });
    expect(
      await getCorrespondenceNeighbors({ id: l2.id, from: 'A', to: 'B', typeId: type.id }),
    ).toEqual({ prevId: l1.id, nextId: null, position: 2, total: 2 });
  });

  it('returns a singleton thread (total 1, no neighbors) for a unique pair', async () => {
    const type = await addType({ code: 'TH4' });
    const only = await letter(type.id, 'A', 'B', '2026-01-01T00:00:00Z');
    await letter(type.id, 'A', 'C', '2026-02-01T00:00:00Z');

    expect(
      await getCorrespondenceNeighbors({ id: only.id, from: 'A', to: 'B', typeId: type.id }),
    ).toEqual({ prevId: null, nextId: null, position: 1, total: 1 });
  });

  it('finds padded endpoints and ignores letters that only contain the names', async () => {
    const type = await addType({ code: 'TH6' });
    const l1 = await letter(type.id, '  Franklin  ', 'Hume', '2026-01-01T00:00:00Z');
    await letter(type.id, 'Franklin Jr', 'Hume', '2026-02-01T00:00:00Z');
    const l3 = await letter(type.id, 'HUME', 'franklin', '2026-03-01T00:00:00Z');

    expect(
      await getCorrespondenceNeighbors({
        id: l1.id,
        from: 'Franklin',
        to: 'Hume',
        typeId: type.id,
      }),
    ).toEqual({ prevId: null, nextId: l3.id, position: 1, total: 2 });
  });

  it('matches non-ASCII endpoints case-insensitively (İ, ß, accents)', async () => {
    const type = await addType({ code: 'THU' });
    const l1 = await letter(type.id, 'Ölçüm Bey', 'Großmann', '2026-01-01T00:00:00Z');
    // "ß" does not fold to "ss" under lower(), so this one is a different person.
    await letter(type.id, 'GROSSMANN', 'Ölçüm Bey', '2026-02-01T00:00:00Z');
    const l3 = await letter(type.id, 'großmann', 'ÖLÇÜM BEY', '2026-03-01T00:00:00Z');
    const l4 = await letter(type.id, 'Éloi', 'Zoë', '2026-04-01T00:00:00Z');
    const l5 = await letter(type.id, 'éLOI', 'ZOË', '2026-05-01T00:00:00Z');

    expect(
      await getCorrespondenceNeighbors({
        id: l1.id,
        from: 'Ölçüm Bey',
        to: 'Großmann',
        typeId: type.id,
      }),
    ).toEqual({ prevId: null, nextId: l3.id, position: 1, total: 2 });
    expect(
      await getCorrespondenceNeighbors({ id: l4.id, from: 'Éloi', to: 'Zoë', typeId: type.id }),
    ).toEqual({ prevId: null, nextId: l5.id, position: 1, total: 2 });
  });

  it('scopes the thread to the same record type', async () => {
    const a = await addType({ code: 'THA' });
    const b = await addType({ code: 'THB' });
    const l1 = await letter(a.id, 'A', 'B', '2026-01-01T00:00:00Z');
    await letter(b.id, 'A', 'B', '2026-02-01T00:00:00Z');

    expect(
      await getCorrespondenceNeighbors({ id: l1.id, from: 'A', to: 'B', typeId: a.id }),
    ).toEqual({ prevId: null, nextId: null, position: 1, total: 1 });
  });

  it('excludes INACTIVE letters unless includeDeleted is set', async () => {
    const type = await addType({ code: 'TH5' });
    const l1 = await letter(type.id, 'A', 'B', '2026-01-01T00:00:00Z');
    const l2 = await letter(type.id, 'A', 'B', '2026-02-01T00:00:00Z');
    await prisma.record.update({ where: { id: l2.id }, data: { status: 'INACTIVE' } });

    expect(
      await getCorrespondenceNeighbors({ id: l1.id, from: 'A', to: 'B', typeId: type.id }),
    ).toEqual({ prevId: null, nextId: null, position: 1, total: 1 });
    expect(
      await getCorrespondenceNeighbors({
        id: l1.id,
        from: 'A',
        to: 'B',
        typeId: type.id,
        includeDeleted: true,
      }),
    ).toEqual({ prevId: null, nextId: l2.id, position: 1, total: 2 });
  });

  it('returns an empty thread when an endpoint is blank', async () => {
    const type = await addType({ code: 'TH6' });
    const l1 = await letter(type.id, 'A', 'B', '2026-01-01T00:00:00Z');
    expect(
      await getCorrespondenceNeighbors({ id: l1.id, from: 'A', to: '  ', typeId: type.id }),
    ).toEqual({ prevId: null, nextId: null, position: 0, total: 0 });
  });
});

describe('listCorrespondenceMap', () => {
  // Give a record map-able coordinates (and a stable entry time + endpoints).
  async function placed(
    typeId: string,
    data: { from?: string; to?: string; fromGeo?: string; toGeo?: string; title?: string },
    iso: string,
  ) {
    const r = await createRecord({ typeId, note: 'm' });
    await prisma.record.update({
      where: { id: r.id },
      data: { ...data, createdAt: new Date(iso) },
    });
    return r;
  }

  it('returns every letter of the type carrying at least one geo endpoint, in entry order', async () => {
    const type = await addType({ code: 'MAP1' });
    const a = await placed(
      type.id,
      { from: 'Franklin', to: 'Collinson', fromGeo: '51.5,-0.1', toGeo: '40,-75', title: 'One' },
      '2026-01-01T00:00:00Z',
    );
    const b = await placed(
      type.id,
      { from: 'Collinson', to: 'Franklin', toGeo: '48.85,2.35' },
      '2026-02-01T00:00:00Z',
    );
    // No coordinates at all → not plottable, so omitted from the map.
    await placed(type.id, { from: 'Franklin', to: 'Hume' }, '2026-03-01T00:00:00Z');

    const letters = await listCorrespondenceMap({ typeId: type.id });
    expect(letters.map((l) => l.id)).toEqual([a.id, b.id]);
    expect(letters[0]).toMatchObject({
      from: 'Franklin',
      to: 'Collinson',
      fromGeo: '51.5,-0.1',
      toGeo: '40,-75',
      title: 'One',
    });
  });

  it('scopes the map to the given type', async () => {
    const a = await addType({ code: 'MAP2A' });
    const b = await addType({ code: 'MAP2B' });
    const mine = await placed(a.id, { fromGeo: '1,1' }, '2026-01-01T00:00:00Z');
    await placed(b.id, { fromGeo: '2,2' }, '2026-01-02T00:00:00Z');

    const letters = await listCorrespondenceMap({ typeId: a.id });
    expect(letters.map((l) => l.id)).toEqual([mine.id]);
  });

  it('excludes INACTIVE letters unless includeDeleted is set', async () => {
    const type = await addType({ code: 'MAP3' });
    const live = await placed(type.id, { fromGeo: '1,1' }, '2026-01-01T00:00:00Z');
    const gone = await placed(type.id, { fromGeo: '2,2' }, '2026-02-01T00:00:00Z');
    await prisma.record.update({ where: { id: gone.id }, data: { status: 'INACTIVE' } });

    expect((await listCorrespondenceMap({ typeId: type.id })).map((l) => l.id)).toEqual([live.id]);
    expect(
      (await listCorrespondenceMap({ typeId: type.id, includeDeleted: true })).map((l) => l.id),
    ).toEqual([live.id, gone.id]);
  });
});

describe('validateRecordRelations', () => {
  it('returns null when every relation id resolves', async () => {
    const type = await addType({ code: 'REL1' });
    const user = await prisma.user.create({ data: { username: 'rel1', name: 'Rel One' } });
    const target = await createRecord({ typeId: type.id, note: 'target' });

    const errors = await validateRecordRelations({
      creatorId: user.id,
      assigneeId: user.id,
      recordId: target.id,
    });
    expect(errors).toBeNull();
  });

  it('returns null when relation ids are absent', async () => {
    expect(await validateRecordRelations({})).toBeNull();
  });

  it('flags a creatorId/assigneeId that does not resolve to an active user', async () => {
    const inactive = await prisma.user.create({
      data: { username: 'rel2', name: 'Rel Two', status: 'INACTIVE' },
    });

    expect(await validateRecordRelations({ creatorId: 'nope' })).toEqual({
      creatorId: 'notFound',
    });
    expect(await validateRecordRelations({ assigneeId: inactive.id })).toEqual({
      assigneeId: 'notFound',
    });
    expect(await validateRecordRelations({ creatorId: 'nope', assigneeId: inactive.id })).toEqual({
      creatorId: 'notFound',
      assigneeId: 'notFound',
    });
  });

  it('flags a recordId that does not resolve to an active record', async () => {
    const type = await addType({ code: 'REL3' });
    const inactive = await createRecord({ typeId: type.id, note: 'gone' });
    await prisma.record.update({ where: { id: inactive.id }, data: { status: 'INACTIVE' } });

    expect(await validateRecordRelations({ recordId: 'nope' })).toEqual({ recordId: 'notFound' });
    expect(await validateRecordRelations({ recordId: inactive.id })).toEqual({
      recordId: 'notFound',
    });
  });

  it('flags a record linking to itself via currentId', async () => {
    const type = await addType({ code: 'REL4' });
    const record = await createRecord({ typeId: type.id, note: 'self' });

    expect(
      await validateRecordRelations({ recordId: record.id }, { currentId: record.id }),
    ).toEqual({ recordId: 'self' });
    // Same id is fine when it is not the record being edited (create, or a
    // different record linking to it).
    expect(await validateRecordRelations({ recordId: record.id })).toBeNull();
  });
});
