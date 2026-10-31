import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  USER_AGENT,
  SOURCES_DIR,
  ensureSources,
  manifest,
  md5,
  type FetchLike,
  type SourceManifest,
} from './fetch';

const body = new TextEncoder().encode('hello world');
const tiny: SourceManifest = {
  itemId: 'x',
  detailsUrl: 'https://archive.org/details/x',
  files: [
    {
      name: 'x_djvu.txt',
      url: 'https://archive.org/download/x/x_djvu.txt',
      md5: md5(body),
      bytes: body.length,
    },
  ],
};
const okFetch = (): FetchLike =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => body.buffer.slice(0) as ArrayBuffer,
  }));

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'jeff-fetch-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('ensureSources', () => {
  it('downloads a missing file once with the honest user agent and writes it', async () => {
    const f = okFetch();
    const r = await ensureSources({ dir, manifest: tiny, fetchImpl: f });
    expect(r.downloaded).toEqual(['x_djvu.txt']);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(tiny.files[0].url, { headers: { 'User-Agent': USER_AGENT } });
    expect(readFileSync(join(dir, 'x_djvu.txt'))).toEqual(Buffer.from(body));
  });

  it('makes zero network calls when the file is cached', async () => {
    writeFileSync(join(dir, 'x_djvu.txt'), body);
    const f = okFetch();
    const r = await ensureSources({ dir, manifest: tiny, fetchImpl: f });
    expect(r.cached).toEqual(['x_djvu.txt']);
    expect(f).not.toHaveBeenCalled();
  });

  it('refuses a cached file whose md5 does not match, without re-downloading', async () => {
    writeFileSync(join(dir, 'x_djvu.txt'), 'tampered');
    const f = okFetch();
    await expect(ensureSources({ dir, manifest: tiny, fetchImpl: f })).rejects.toThrow(/md5/);
    expect(f).not.toHaveBeenCalled();
  });

  it('does not write a download whose md5 does not match', async () => {
    const bad: SourceManifest = { ...tiny, files: [{ ...tiny.files[0], md5: '0'.repeat(32) }] };
    await expect(ensureSources({ dir, manifest: bad, fetchImpl: okFetch() })).rejects.toThrow(
      /md5/,
    );
    expect(existsSync(join(dir, 'x_djvu.txt'))).toBe(false);
  });

  it('fails on a non-OK response', async () => {
    const f: FetchLike = async () => ({
      ok: false,
      status: 503,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await expect(ensureSources({ dir, manifest: tiny, fetchImpl: f })).rejects.toThrow(/503/);
  });
});

describe('committed cache', () => {
  it('has every manifest file with the expected md5 and no network needed', async () => {
    const f = okFetch();
    const r = await ensureSources({ dir: SOURCES_DIR, fetchImpl: f });
    expect(r.cached).toHaveLength(manifest.files.length);
    expect(f).not.toHaveBeenCalled();
  });

  it('uses a user agent with a project URL and no email address', () => {
    expect(USER_AGENT).toContain('https://github.com/filips-alpe/lit-crm');
    expect(USER_AGENT).not.toMatch(/@/);
  });

  it('uses /download/ URLs, never /stream/', () => {
    for (const f of manifest.files) expect(f.url).toMatch(/^https:\/\/archive\.org\/download\//);
  });
});
