import { describe, expect, it } from 'vitest';
import { buildJeffersonRows, JEFFERSON_PROJECTS } from './seed';
import { jeffersonTypes } from './types';
import { projects as franklinProjects, types as franklinTypes } from '../load';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const generated = resolve(dirname(fileURLToPath(import.meta.url)), '../generated/jefferson');
const counts = {
  records: (JSON.parse(readFileSync(resolve(generated, 'records.json'), 'utf8')) as unknown[])
    .length,
  entities: (JSON.parse(readFileSync(resolve(generated, 'entities.json'), 'utf8')) as unknown[])
    .length,
  mentions: (JSON.parse(readFileSync(resolve(generated, 'mentions.json'), 'utf8')) as unknown[])
    .length,
};

const { records, mentions } = buildJeffersonRows();
const byId = new Map(records.map((r) => [r.id, r]));

describe('buildJeffersonRows', () => {
  it('maps every generated record, entity and mention', () => {
    expect(records).toHaveLength(counts.records + counts.entities);
    expect(mentions).toHaveLength(counts.mentions);
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
    expect(new Set(mentions.map((m) => m.id)).size).toBe(mentions.length);
  });

  it('uses only types defined in types.yaml and only the six projects', () => {
    const typeCodes = new Set(jeffersonTypes.map((t) => t.code));
    const projectCodes = new Set<string>(JEFFERSON_PROJECTS.map((p) => p.code));
    for (const r of records) {
      expect(typeCodes.has(r.typeCode), r.typeCode).toBe(true);
      expect(projectCodes.has(r.projectCode), r.projectCode).toBe(true);
    }
  });

  it('dates createdAt from 1905-01-01 a millisecond apart, strictly increasing', () => {
    expect(records[0].createdAt.toISOString()).toBe('1905-01-01T00:00:00.000Z');
    for (let i = 1; i < records.length; i++) {
      expect(records[i].createdAt.getTime() - records[i - 1].createdAt.getTime()).toBe(1);
    }
  });

  it('every mention slices to its surface inside a source record, and targets an entity record', () => {
    for (const m of mentions) {
      const src = byId.get(m.recordId)!;
      expect(src.text!.slice(m.start, m.end)).toBe(m.surface);
      expect(byId.get(m.entityId)!.projectCode).toBe('jefferson-entities');
    }
  });

  it('every row carries its sources', () => {
    for (const r of records) {
      expect(r.references.length).toBeGreaterThanOrEqual(2);
      expect(r.references[0]).toContain('archive.org/details/writingsofthomas0000vari_v5r4');
    }
  });
});

describe('collision with the Franklin set', () => {
  it('reuses no type or project code, no project colour', () => {
    const franklinTypeCodes = new Set(franklinTypes.map((t) => t.code));
    for (const t of jeffersonTypes) expect(franklinTypeCodes.has(t.code)).toBe(false);
    const franklinProjectCodes = new Set(franklinProjects.map((p) => p.code));
    const franklinColors = new Set(franklinProjects.map((p) => p.color.toLowerCase()));
    for (const p of JEFFERSON_PROJECTS) {
      expect(franklinProjectCodes.has(p.code)).toBe(false);
      expect(franklinColors.has(p.color.toLowerCase())).toBe(false);
    }
    const own = JEFFERSON_PROJECTS.map((p) => p.color);
    expect(new Set(own).size).toBe(own.length);
  });
});
