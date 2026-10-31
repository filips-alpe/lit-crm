import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as YAML from 'yaml';
import type { SeedType } from '../types-defs';

const here = dirname(fileURLToPath(import.meta.url));

/** The Jefferson types as written in types.yaml (source types first, then entity types). */
export const jeffersonTypes: SeedType[] = YAML.parse(
  readFileSync(resolve(here, 'types.yaml'), 'utf8'),
) as SeedType[];

export const ENTITY_TYPE_CODES = [
  'person',
  'people',
  'place',
  'organization',
  'work',
  'event',
  'thing',
] as const;
export type EntityTypeCode = (typeof ENTITY_TYPE_CODES)[number];
