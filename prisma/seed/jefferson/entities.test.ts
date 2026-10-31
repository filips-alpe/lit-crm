import { describe, expect, it } from 'vitest';
import { buildAliasIndex, loadGazetteer, parseGazetteer, resolveIn } from './entities';
import { ENTITY_TYPE_CODES } from './types';

const gaz = (yaml: string) => buildAliasIndex(parseGazetteer(yaml));

describe('gazetteer validation', () => {
  it('refuses a surface that maps to two entities', () => {
    expect(() =>
      gaz(`
entities:
  - { key: a, name: Alpha, type: person, aliases: [Shared] }
  - { key: b, name: Beta, type: person, aliases: [Shared] }
`),
    ).toThrow(/Shared.*both a and b/);
  });

  it('refuses an entity name that is another entity alias', () => {
    expect(() =>
      gaz(`
entities:
  - { key: a, name: Alpha, type: person }
  - { key: b, name: Beta, type: person, aliases: [Alpha] }
`),
    ).toThrow(/Alpha/);
  });

  it('refuses a surface that is both an alias and ambiguous', () => {
    expect(() =>
      gaz(`
entities:
  - { key: a, name: Alpha, type: person, aliases: [Adams] }
  - { key: b, name: Beta, type: person }
ambiguous:
  - { surface: Adams, candidates: [a, b], reason: two different men share it }
`),
    ).toThrow(/both an alias and ambiguous/);
  });

  it('accepts one candidate only when the surface also names someone without a record', () => {
    const g = parseGazetteer(`
entities:
  - { key: a, name: A One, type: person }
ambiguous:
  - { surface: Coxe, candidates: [a], otherReferents: true, reason: another Coxe has no record }
`);
    expect(g.ambiguous[0].otherReferents).toBe(true);
  });

  it('refuses an ambiguous surface with fewer than two or unknown candidates', () => {
    expect(() =>
      parseGazetteer(`
entities:
  - { key: a, name: Alpha, type: person }
ambiguous:
  - { surface: Adams, candidates: [a], reason: only one candidate here }
`),
    ).toThrow();
    expect(() =>
      gaz(`
entities:
  - { key: a, name: Alpha, type: person }
  - { key: b, name: Beta, type: person }
ambiguous:
  - { surface: Adams, candidates: [a, ghost], reason: a candidate that does not exist }
`),
    ).toThrow(/ghost/);
  });

  it('refuses two entities claiming one surface in the same part', () => {
    expect(() =>
      gaz(`
entities:
  - { key: a, name: Alpha, type: person, nameIsAlias: false, scopedAliases: { anas: [Bare] } }
  - { key: b, name: Beta, type: person, nameIsAlias: false, scopedAliases: { anas: [Bare] } }
`),
    ).toThrow(/Bare.*anas/);
  });

  it('refuses a scoped alias that is already another entity global alias', () => {
    expect(() =>
      gaz(`
entities:
  - { key: a, name: Alpha, type: person, aliases: [Bare] }
  - { key: b, name: Beta, type: person, scopedAliases: { anas: [Bare] } }
`),
    ).toThrow(/global alias/);
  });

  it('resolves a scoped alias only inside its part, and over an ambiguous surface', () => {
    const ix = gaz(`
entities:
  - { key: edmund, name: Edmund Randolph, type: person, scopedAliases: { anas: [Randolph] } }
  - { key: peyton, name: Peyton Randolph, type: person, scopedAliases: { autobiography: [Randolph] } }
ambiguous:
  - { surface: Randolph, candidates: [edmund, peyton], reason: two Randolphs share the surname }
`);
    const e = ix.entries.get('Randolph')!;
    expect(resolveIn(e, 'anas')).toEqual({ kind: 'entity', entityKey: 'edmund' });
    expect(resolveIn(e, 'autobiography')).toEqual({ kind: 'entity', entityKey: 'peyton' });
    expect(resolveIn(e, 'editorial')?.kind).toBe('ambiguous');
  });
});

describe('the curated gazetteer', () => {
  const g = loadGazetteer();
  const ix = buildAliasIndex(g); // throws if any alias maps to two entities

  it('is several hundred entities of the declared types, with unique keys and names', () => {
    expect(g.entities.length).toBeGreaterThanOrEqual(400);
    expect(new Set(g.entities.map((e) => e.key)).size).toBe(g.entities.length);
    expect(new Set(g.entities.map((e) => e.name + '|' + e.type)).size).toBe(g.entities.length);
    for (const e of g.entities) expect(ENTITY_TYPE_CODES).toContain(e.type);
    const types = new Set(g.entities.map((e) => e.type));
    expect([...types].sort()).toEqual([...ENTITY_TYPE_CODES].sort());
  });

  it('lists the shared surnames and the person/place collisions as ambiguous', () => {
    const surfaces = new Set(g.ambiguous.map((a) => a.surface));
    for (const s of [
      'Adams',
      'Randolph',
      'Lee',
      'Morris',
      'Livingston',
      'Henry',
      'Clinton',
      'Washington',
      'Madison',
      'Jefferson',
      'Franklin',
      'Lincoln',
      'Hamilton',
    ]) {
      expect(surfaces.has(s), s).toBe(true);
    }
    for (const a of g.ambiguous) {
      expect(a.candidates.length).toBeGreaterThanOrEqual(a.otherReferents ? 1 : 2);
      for (const c of a.candidates) expect(ix.entities.has(c), `${a.surface} -> ${c}`).toBe(true);
    }
  });

  it('never lets a bare ambiguous surface resolve globally to an entity', () => {
    for (const a of g.ambiguous) expect(ix.entries.get(a.surface)!.global?.kind).toBe('ambiguous');
  });

  it('resolves the checked bare surnames only where reading the text justified it', () => {
    const at = (s: string, part: Parameters<typeof resolveIn>[1]) =>
      resolveIn(ix.entries.get(s)!, part);
    expect(at('Randolph', 'anas')).toEqual({ kind: 'entity', entityKey: 'edmund-randolph' });
    expect(at('Randolph', 'autobiography')).toEqual({
      kind: 'entity',
      entityKey: 'peyton-randolph',
    });
    expect(at('Randolph', 'notes-on-virginia')?.kind).toBe('ambiguous');
    expect(at('Washington', 'anas')?.kind).toBe('ambiguous');
    expect(at('Clinton', 'anas')?.kind).toBe('ambiguous');
    expect(at('Adams', 'autobiography')?.kind).toBe('ambiguous');
    expect(at('Mr. Adams', 'autobiography')).toEqual({ kind: 'entity', entityKey: 'john-adams' });
    expect(at('Jefferson', 'notes-on-virginia')?.kind).toBe('ambiguous');
    expect(at('Jefferson', 'anas')).toEqual({ kind: 'entity', entityKey: 'thomas-jefferson' });
    expect(at('Logan', 'anas')).toBeUndefined();
    expect(at('Logan', 'notes-on-virginia')).toEqual({ kind: 'entity', entityKey: 'logan' });
  });
});
