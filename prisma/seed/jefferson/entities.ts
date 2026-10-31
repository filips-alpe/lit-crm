/**
 * The gazetteer: curated entities with their surface forms, and the bare surfaces that name more
 * than one plausible entity and so are never linked. Pure data in gazetteer.yaml; this module
 * parses, validates and indexes it. No entity carries any fact beyond a name, a type and variants.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as YAML from 'yaml';
import { z } from 'zod';
import type { PartId } from './split';
import { ENTITY_TYPE_CODES } from './types';

const PARTS = [
  'autobiography',
  'anas',
  'notes-on-virginia',
  'parliamentary-manual',
  'editorial',
] as const satisfies readonly PartId[];

const surface = z
  .string()
  .min(2)
  .refine((s) => s === s.trim() && !/\s{2}|\n/.test(s), 'surface must be trimmed single-spaced');

const entitySchema = z.object({
  key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: surface,
  type: z.enum(ENTITY_TYPE_CODES),
  aliases: z.array(surface).default([]),
  /** Surfaces that name this entity only inside the given part of the text. */
  scopedAliases: z.partialRecord(z.enum(PARTS), z.array(surface)).optional(),
  /** False when the name itself is a surface that holds only inside the scoped parts. Default true. */
  nameIsAlias: z.boolean().optional(),
  note: z.string().optional(),
});

const ambiguousSchema = z.object({
  surface,
  candidates: z.array(z.string()).min(2),
  reason: z.string().min(10),
});

export const gazetteerSchema = z.object({
  entities: z.array(entitySchema),
  ambiguous: z.array(ambiguousSchema).default([]),
});

export type GazetteerEntity = z.infer<typeof entitySchema>;
export type AmbiguousSurface = z.infer<typeof ambiguousSchema>;
export type Gazetteer = z.infer<typeof gazetteerSchema>;

const here = dirname(fileURLToPath(import.meta.url));

export function parseGazetteer(source: string): Gazetteer {
  return gazetteerSchema.parse(YAML.parse(source));
}

export function loadGazetteer(path: string = resolve(here, 'gazetteer.yaml')): Gazetteer {
  return parseGazetteer(readFileSync(path, 'utf8'));
}

/** What a surface resolves to in a given part. */
export type Resolution =
  | { kind: 'entity'; entityKey: string }
  | { kind: 'ambiguous'; candidates: string[]; reason: string };

export type AliasEntry = {
  surface: string;
  global?: Resolution;
  scoped: Map<PartId, string>;
};

export type AliasIndex = {
  entities: Map<string, GazetteerEntity>;
  entries: Map<string, AliasEntry>;
  /** entries grouped by the leading run of letters/digits, longest surface first */
  byLead: Map<string, AliasEntry[]>;
};

export const leadOf = (s: string): string => /^[\p{L}\p{N}]+/u.exec(s)?.[0] ?? '';

export function resolveIn(entry: AliasEntry, part: PartId): Resolution | undefined {
  const scoped = entry.scoped.get(part);
  if (scoped) return { kind: 'entity', entityKey: scoped };
  return entry.global;
}

/** Index the gazetteer; throws on any surface that would map to two entities. */
export function buildAliasIndex(g: Gazetteer): AliasIndex {
  const entities = new Map<string, GazetteerEntity>();
  for (const e of g.entities) {
    if (entities.has(e.key)) throw new Error(`duplicate entity key ${e.key}`);
    entities.set(e.key, e);
  }
  const entries = new Map<string, AliasEntry>();
  const entry = (s: string): AliasEntry => {
    let e = entries.get(s);
    if (!e) entries.set(s, (e = { surface: s, scoped: new Map() }));
    return e;
  };
  for (const e of g.entities) {
    for (const s of new Set([...(e.nameIsAlias === false ? [] : [e.name]), ...e.aliases])) {
      const en = entry(s);
      if (en.global) {
        const other = en.global.kind === 'entity' ? en.global.entityKey : 'ambiguous';
        throw new Error(`surface "${s}" maps to both ${other} and ${e.key}`);
      }
      en.global = { kind: 'entity', entityKey: e.key };
    }
  }
  for (const a of g.ambiguous) {
    for (const c of a.candidates) {
      if (!entities.has(c)) throw new Error(`ambiguous "${a.surface}": unknown candidate ${c}`);
    }
    const en = entry(a.surface);
    if (en.global) throw new Error(`surface "${a.surface}" is both an alias and ambiguous`);
    en.global = { kind: 'ambiguous', candidates: a.candidates, reason: a.reason };
  }
  for (const e of g.entities) {
    for (const [part, list] of Object.entries(e.scopedAliases ?? {})) {
      for (const s of list ?? []) {
        const en = entry(s);
        if (en.global?.kind === 'entity') {
          throw new Error(
            `scoped alias "${s}" (${e.key}, ${part}) is a global alias of ${en.global.entityKey}`,
          );
        }
        if (en.scoped.has(part as PartId)) {
          throw new Error(
            `scoped alias "${s}" in ${part} maps to ${en.scoped.get(part as PartId)} and ${e.key}`,
          );
        }
        en.scoped.set(part as PartId, e.key);
      }
    }
  }
  const byLead = new Map<string, AliasEntry[]>();
  for (const en of entries.values()) {
    const lead = leadOf(en.surface);
    if (!lead) throw new Error(`surface "${en.surface}" does not start with a letter or digit`);
    byLead.set(lead, [...(byLead.get(lead) ?? []), en]);
  }
  for (const list of byLead.values()) list.sort((a, b) => b.surface.length - a.surface.length);
  return { entities, entries, byLead };
}
