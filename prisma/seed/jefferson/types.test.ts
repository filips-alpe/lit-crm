import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { layoutSchema, typeSchema } from '../../../src/lib/schemas/types';
import type { SeedType } from '../types-defs';
import { ENTITY_TYPE_CODES, jeffersonTypes } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const franklin = YAML.parse(
  readFileSync(resolve(here, '../data/types.yaml'), 'utf8'),
) as SeedType[];

const SOURCE_CODES = [
  'memoir-section',
  'memorandum',
  'query',
  'manual-section',
  'correspondence-copy',
  'official-paper',
  'deposition',
  'editorial-note',
  'front-matter',
];

describe('jefferson types.yaml', () => {
  it('defines the nine source types and seven entity types', () => {
    expect(jeffersonTypes.map((t) => t.code)).toEqual([...SOURCE_CODES, ...ENTITY_TYPE_CODES]);
  });

  it.each(jeffersonTypes.map((t) => [t.code, t] as const))(
    '%s validates with typeSchema',
    (_c, t) => {
      const parsed = typeSchema.safeParse(t);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(layoutSchema.safeParse(t.layout).success).toBe(true);
    },
  );

  it.each(jeffersonTypes.map((t) => [t.code, t] as const))(
    '%s follows the layout conventions of data/types.yaml',
    (_c, t) => {
      const f = t.layout!.fields;
      expect(f[0]).toMatchObject({ kind: 'text', writeTo: 'title' });
      expect(f.at(-1)).toMatchObject({ kind: 'list', writeTo: 'references' });
      const body = f.find((x) => x.writeTo === 'text');
      if (SOURCE_CODES.includes(t.code)) expect(body).toMatchObject({ kind: 'markdown' });
      else expect(body).toBeUndefined();
    },
  );

  it('does not reuse a Franklin code, and codes and colors are distinct', () => {
    const codes = jeffersonTypes.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(franklin.map((t) => t.code)).not.toContain(c);
    const colors = jeffersonTypes.map((t) => t.color.toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
    for (const c of colors) expect(franklin.map((t) => t.color.toLowerCase())).not.toContain(c);
    const seeds = jeffersonTypes.map((t) => t.iconSeed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('gives source types the source-text renderer and entity types none', () => {
    for (const t of jeffersonTypes) {
      if (SOURCE_CODES.includes(t.code)) expect(t.rendererId).toBe('source-text');
      else expect(t.rendererId).toBeUndefined();
    }
  });
});
