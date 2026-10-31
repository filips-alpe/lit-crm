import { beforeAll, describe, expect, it } from 'vitest';
import { buildAliasIndex, loadGazetteer, parseGazetteer, type AliasIndex } from './entities';
import { buildContext, cleanRange } from './clean';
import { loadSources } from './fetch';
import { linkMentions, linkRecord } from './link';
import { mapLines } from './pages';
import { buildSplit } from './split';

const toy = buildAliasIndex(
  parseGazetteer(`
entities:
  - { key: hamilton, name: Alexander Hamilton, type: person, aliases: [Colonel Hamilton], scopedAliases: { anas: [Hamilton] } }
  - { key: morris-g, name: Gouverneur Morris, type: person, aliases: [G. Morris] }
  - { key: morris-r, name: Robert Morris, type: person }
  - { key: adams-j, name: John Adams, type: person, aliases: [Mr. Adams] }
  - { key: adams-s, name: Samuel Adams, type: person }
  - { key: washington, name: George Washington, type: person, aliases: [General Washington] }
  - { key: wash-county, name: Washington County, type: place }
  - { key: virginia, name: Virginia, type: place }
  - { key: univ, name: University of Virginia, type: organization }
  - { key: anti, name: Mount Vernon, type: place }
ambiguous:
  - { surface: Morris, candidates: [morris-g, morris-r], reason: two Morrises are named }
  - { surface: Adams, candidates: [adams-j, adams-s], reason: two Adamses are named }
  - { surface: Washington, candidates: [washington, wash-county], reason: general or county }
`),
);

describe('linkMentions (synthetic)', () => {
  it('links whole words, case-sensitively, with slice equality', () => {
    const text = 'Then Colonel Hamilton said Hamiltonian ideas and hamilton were not his.';
    const { mentions } = linkMentions(text, toy, 'autobiography');
    expect(mentions).toEqual([
      { start: 5, end: 21, surface: 'Colonel Hamilton', entityKey: 'hamilton' },
    ]);
    for (const m of mentions) expect(text.slice(m.start, m.end)).toBe(m.surface);
  });

  it('takes the longest match and does not overlap', () => {
    const text =
      'Gouverneur Morris met Robert Morris and Morris at the University of Virginia in Virginia.';
    const { mentions, ambiguous } = linkMentions(text, toy, 'anas');
    expect(mentions.map((m) => [m.surface, m.entityKey])).toEqual([
      ['Gouverneur Morris', 'morris-g'],
      ['Robert Morris', 'morris-r'],
      ['University of Virginia', 'univ'],
      ['Virginia', 'virginia'],
    ]);
    expect(ambiguous.map((a) => a.surface)).toEqual(['Morris']);
    const spans = [...mentions, ...ambiguous].sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i++)
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
  });

  it('leaves an ambiguous bare surname unlinked, and reports it', () => {
    const { mentions, ambiguous } = linkMentions(
      'Adams spoke, and Mr. Adams answered.',
      toy,
      'anas',
    );
    expect(mentions.map((m) => m.entityKey)).toEqual(['adams-j']);
    expect(ambiguous).toEqual([
      { start: 0, end: 5, surface: 'Adams', candidates: ['adams-j', 'adams-s'] },
    ]);
  });

  it('does not let an ambiguous name leak a shorter link', () => {
    const { mentions, ambiguous } = linkMentions(
      'Washington County lies near Washington.',
      toy,
      'anas',
    );
    expect(mentions.map((m) => m.surface)).toEqual(['Washington County']);
    expect(ambiguous.map((a) => a.surface)).toEqual(['Washington']);
  });

  it('handles possessives: the link covers the name, not the s', () => {
    const text = "Hamilton’s plan and General Washington's army, Colonel Hamilton's friend.";
    const { mentions } = linkMentions(text, toy, 'anas');
    expect(mentions.map((m) => m.surface)).toEqual([
      'Hamilton',
      'General Washington',
      'Colonel Hamilton',
    ]);
    for (const m of mentions) expect(text.slice(m.start, m.end)).toBe(m.surface);
  });

  it('applies a scoped alias only in its part', () => {
    expect(linkMentions('Hamilton spoke.', toy, 'anas').mentions).toHaveLength(1);
    expect(linkMentions('Hamilton spoke.', toy, 'autobiography').mentions).toHaveLength(0);
  });

  it('does not link inside a hyphenated word', () => {
    expect(
      linkMentions('the anti-Virginia party and Virginia-born men', toy, 'anas').mentions,
    ).toEqual([]);
    expect(linkMentions('in Virginia, and in Virginia.', toy, 'anas').mentions).toHaveLength(2);
  });

  it('is deterministic for the same input', () => {
    const t = 'Mr. Adams, Morris, Hamilton and Virginia.';
    expect(linkMentions(t, toy, 'anas')).toEqual(linkMentions(t, toy, 'anas'));
  });

  it('never links front matter', () => {
    const text = 'Mr. Adams in Virginia.';
    expect(linkRecord({ type: 'front-matter', part: 'editorial', text }, toy).mentions).toEqual([]);
    expect(
      linkRecord({ type: 'editorial-note', part: 'editorial', text }, toy).mentions,
    ).toHaveLength(2);
  });
});

describe('linkMentions (real corpus)', () => {
  let ix: AliasIndex;
  let recs: { key: string; part: string; type: string; text: string }[] = [];
  beforeAll(() => {
    const src = loadSources();
    const lines = src.djvu.split('\n');
    const map = mapLines(src.djvu, src.searchtext, src.pageindex, src.pageLabels);
    const ctx = buildContext(lines, map);
    recs = buildSplit({ lines, map, ctx }).records.map((r) => ({
      key: r.key,
      part: r.part,
      type: r.type,
      text: cleanRange(ctx, r.start - 1, r.end - 1).text,
    }));
    ix = buildAliasIndex(loadGazetteer());
  });

  const link = (r: (typeof recs)[number]) =>
    linkRecord({ type: r.type as never, part: r.part as never, text: r.text }, ix);

  it('keeps text.slice(start, end) === surface for every mention, with no overlaps', () => {
    let total = 0;
    for (const r of recs) {
      const { mentions, ambiguous } = link(r);
      const spans = [...mentions, ...ambiguous].sort((a, b) => a.start - b.start);
      for (const s of spans) expect(r.text.slice(s.start, s.end)).toBe(s.surface);
      for (let i = 1; i < spans.length; i++)
        expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
      total += mentions.length;
    }
    expect(total).toBeGreaterThan(5000);
  });

  it('links nothing in front-matter records', () => {
    for (const r of recs.filter((x) => x.type === 'front-matter')) {
      expect(link(r).mentions).toEqual([]);
    }
  });

  it('keeps the collisions it must: bare Washington, Adams, Lee and Clinton never become links', () => {
    const bare = new Set([
      'Washington',
      'Adams',
      'Lee',
      'Clinton',
      'Morris',
      'Livingston',
      'Henry',
      'Smith',
    ]);
    for (const r of recs) {
      for (const m of link(r).mentions) {
        if (m.surface === 'Henry')
          expect(r.part).toBe('autobiography'); // scoped: Patrick Henry
        else expect(bare.has(m.surface), `${r.key}: ${m.surface}`).toBe(false);
      }
    }
  });

  it('resolves Randolph by part and leaves it alone elsewhere', () => {
    const byPart: Record<string, Set<string>> = {};
    const unresolved: string[] = [];
    for (const r of recs) {
      const res = link(r);
      for (const m of res.mentions.filter((x) => x.surface === 'Randolph')) {
        (byPart[r.part] ??= new Set()).add(m.entityKey);
      }
      unresolved.push(...res.ambiguous.filter((x) => x.surface === 'Randolph').map(() => r.part));
    }
    expect([...byPart.anas]).toEqual(['edmund-randolph']);
    expect([...byPart.autobiography]).toEqual(['peyton-randolph']);
    expect(Object.keys(byPart).sort()).toEqual(['anas', 'autobiography']);
    expect(unresolved.length).toBeGreaterThanOrEqual(0);
  });

  it('does not take the Raleigh tavern for Sir Walter, or Wilmington Mirror for the town', () => {
    const all = recs.flatMap((r) => link(r).mentions.map((m) => `${m.entityKey}:${m.surface}`));
    expect(all).not.toContain('sir-walter-raleigh:Raleigh');
    expect(all).toContain('wilmington-mirror:Wilmington Mirror');
  });
});
