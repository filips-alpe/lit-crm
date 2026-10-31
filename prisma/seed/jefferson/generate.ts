/**
 * Writes the Jefferson dataset: `prisma/seed/generated/jefferson/{records,entities,mentions,cleanup-log}.json`
 * and `prisma/seed/jefferson/REPORT.md`. Reads only the cached sources (no network) and is
 * byte-identical on re-run.
 *
 *   tsx prisma/seed/jefferson/generate.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDataset, type Dataset } from './dataset';
import { renderReport } from './report';

const here = dirname(fileURLToPath(import.meta.url));
export const OUTPUT_DIR = resolve(here, '../generated/jefferson');
export const REPORT_PATH = resolve(here, 'REPORT.md');

/** The files a run writes, as [absolute path, content]. */
export function renderOutputs(d: Dataset, dir: string = OUTPUT_DIR): [string, string][] {
  const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
  return [
    [resolve(dir, 'records.json'), json(d.records)],
    [resolve(dir, 'entities.json'), json(d.entities)],
    [resolve(dir, 'mentions.json'), json(d.mentions)],
    [resolve(dir, 'cleanup-log.json'), json(d.cleanupLog)],
    [REPORT_PATH, renderReport(d)],
  ];
}

export function main(): void {
  const d = buildDataset();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [path, content] of renderOutputs(d)) writeFileSync(path, content);
  console.log(
    `Jefferson: ${d.records.length} records, ${d.entities.length} entities, ${d.mentions.length} mentions, ` +
      `${d.cleanupLog.length} cleanup entries. Wrote ${OUTPUT_DIR} and ${REPORT_PATH}.`,
  );
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMain) main();
