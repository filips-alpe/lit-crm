/**
 * Cache-first download of the Internet Archive OCR files for the Jefferson
 * corpus. Files live in `prisma/seed/sources/jefferson/` and are committed, so
 * a normal run never touches the network. A file that is already cached is only
 * verified against the md5 in `sources.manifest.json`; a missing file is
 * downloaded once, verified, and written. A mismatch (cached or downloaded) is
 * an error, never a silent re-download.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import manifestJson from './sources.manifest.json';

export const USER_AGENT = 'lit-crm seed pipeline (https://github.com/filips-alpe/lit-crm)';

export type SourceFile = { name: string; url: string; md5: string; bytes: number };
export type SourceManifest = { itemId: string; detailsUrl: string; files: SourceFile[] };

export const manifest: SourceManifest = manifestJson;

const here = dirname(fileURLToPath(import.meta.url));
export const SOURCES_DIR = resolve(here, '../sources/jefferson');

export type FetchResponse = {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};
export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<FetchResponse>;

export const md5 = (data: Uint8Array): string => createHash('md5').update(data).digest('hex');

export type EnsureResult = { downloaded: string[]; cached: string[] };

export async function ensureSources(
  opts: {
    dir?: string;
    manifest?: SourceManifest;
    fetchImpl?: FetchLike;
  } = {},
): Promise<EnsureResult> {
  const dir = opts.dir ?? SOURCES_DIR;
  const man = opts.manifest ?? manifest;
  const doFetch: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const result: EnsureResult = { downloaded: [], cached: [] };
  mkdirSync(dir, { recursive: true });
  for (const file of man.files) {
    const path = resolve(dir, file.name);
    if (existsSync(path)) {
      const actual = md5(readFileSync(path));
      if (actual !== file.md5) {
        throw new Error(
          `Cached ${file.name} has md5 ${actual}, expected ${file.md5}. Delete it to re-download.`,
        );
      }
      result.cached.push(file.name);
      continue;
    }
    const res = await doFetch(file.url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Download of ${file.url} failed with HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const actual = md5(bytes);
    if (actual !== file.md5) {
      throw new Error(`Downloaded ${file.name} has md5 ${actual}, expected ${file.md5}`);
    }
    writeFileSync(path, bytes);
    result.downloaded.push(file.name);
  }
  return result;
}

export type LoadedSources = {
  djvu: string;
  searchtext: string;
  /** pageindex[k] = [textStart, textEnd, ...] offsets into `searchtext` for leaf k */
  pageindex: number[][];
  /** printed page label per leaf number ('' when the leaf has none) */
  pageLabels: Map<number, string>;
};

export function loadSources(dir: string = SOURCES_DIR): LoadedSources {
  const read = (suffix: string) => {
    const f = manifest.files.find((x) => x.name.endsWith(suffix));
    if (!f) throw new Error(`manifest has no file ending ${suffix}`);
    return readFileSync(resolve(dir, f.name));
  };
  const pageNumbers = JSON.parse(read('_page_numbers.json').toString('utf8')) as {
    pages: { leafNum: number; pageNumber: string }[];
  };
  return {
    djvu: read('_djvu.txt').toString('utf8'),
    searchtext: gunzipSync(read('_hocr_searchtext.txt.gz')).toString('utf8'),
    pageindex: JSON.parse(gunzipSync(read('_hocr_pageindex.json.gz')).toString('utf8')),
    pageLabels: new Map(pageNumbers.pages.map((p) => [p.leafNum, p.pageNumber])),
  };
}
