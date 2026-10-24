import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  symlinkSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitCloneArgs, installExtension, listExtensions, uninstallExtension } from './lib';

let work: string;
let root: string;

function makeSource(name: string, files: Record<string, string>): string {
  const dir = join(work, 'src-' + name);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'ext-'));
  root = join(work, 'extensions');
  mkdirSync(root);
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

describe('installExtension', () => {
  it('copies a folder under its manifest id', () => {
    const src = makeSource('x', {
      'extension.json': '{"id":"clio"}',
      'renderers/index.ts': 'export const renderers = [];',
    });
    expect(installExtension(src, root)).toEqual({ id: 'clio', replaced: false });
    expect(existsSync(join(root, 'clio/renderers/index.ts'))).toBe(true);
  });

  it('falls back to the folder name when there is no manifest', () => {
    const src = makeSource('clio', { 'dashboards/index.ts': 'export const dashboards = {};' });
    expect(installExtension(src, root).id).toBe('src-clio');
  });

  it('skips .git and node_modules', () => {
    const src = makeSource('y', {
      'extension.json': '{"id":"y"}',
      'renderers/index.ts': '',
      '.git/HEAD': 'x',
      'node_modules/a/b.js': 'x',
    });
    installExtension(src, root);
    expect(readdirSync(join(root, 'y')).sort()).toEqual(['extension.json', 'renderers']);
  });

  it('refuses a folder with no renderers or dashboards entry point', () => {
    const src = makeSource('z', { 'extension.json': '{"id":"z"}', 'readme.md': '' });
    expect(() => installExtension(src, root)).toThrow(/renderers\/index\.ts|dashboards\/index\.ts/);
  });

  it('refuses an invalid id', () => {
    const src = makeSource('w', { 'extension.json': '{"id":"../evil"}', 'renderers/index.ts': '' });
    expect(() => installExtension(src, root)).toThrow(/invalid extension id/i);
  });

  it('refuses to overwrite unless forced', () => {
    const src = makeSource('v', { 'extension.json': '{"id":"v"}', 'renderers/index.ts': '' });
    installExtension(src, root);
    expect(() => installExtension(src, root)).toThrow(/already installed/);
    expect(installExtension(src, root, { force: true })).toEqual({ id: 'v', replaced: true });
  });

  it('refuses a missing source', () => {
    expect(() => installExtension(join(work, 'nope'), root)).toThrow(/not found/i);
  });
});

describe('uninstallExtension', () => {
  it('removes the folder', () => {
    const src = makeSource('u', { 'extension.json': '{"id":"u"}', 'dashboards/index.ts': '' });
    installExtension(src, root);
    uninstallExtension('u', root);
    expect(existsSync(join(root, 'u'))).toBe(false);
  });

  it('fails for an extension that is not installed', () => {
    expect(() => uninstallExtension('ghost', root)).toThrow(/not installed/);
  });

  it('refuses ids that could escape the root', () => {
    expect(() => uninstallExtension('..', root)).toThrow(/invalid extension id/i);
  });
});

describe('listExtensions', () => {
  it('reports what each installed extension contributes', () => {
    installExtension(
      makeSource('a', { 'extension.json': '{"id":"a"}', 'renderers/index.ts': '' }),
      root,
    );
    installExtension(
      makeSource('b', {
        'extension.json': '{"id":"b"}',
        'renderers/index.ts': '',
        'dashboards/index.ts': '',
      }),
      root,
    );
    mkdirSync(join(root, 'not-an-extension'));
    expect(listExtensions(root)).toEqual([
      { id: 'a', renderers: true, dashboards: false },
      { id: 'b', renderers: true, dashboards: true },
    ]);
  });
});

describe('installExtension edge cases', () => {
  it('reports a malformed extension.json with its path', () => {
    const src = makeSource('bad', { 'extension.json': '{nope', 'renderers/index.ts': '' });
    expect(() => installExtension(src, root)).toThrow(/Invalid .*extension\.json/);
  });

  it('falls back to the folder name when the manifest has no string id', () => {
    const src = makeSource('plain', { 'extension.json': 'null', 'renderers/index.ts': '' });
    expect(installExtension(src, root).id).toBe('src-plain');
  });

  it('skips .git, node_modules and symlinks when copying', () => {
    const src = makeSource('sl', {
      'extension.json': '{"id":"sl"}',
      'renderers/index.ts': '',
      '.git/config': 'x',
      'node_modules/a/index.js': 'x',
    });
    symlinkSync(work, join(src, 'escape'));
    installExtension(src, root);
    const names = readdirSync(join(root, 'sl'));
    expect(names).toContain('renderers');
    expect(names).not.toContain('.git');
    expect(names).not.toContain('node_modules');
    expect(names).not.toContain('escape');
  });
});

describe('gitCloneArgs', () => {
  it('ends option parsing before the source', () => {
    expect(gitCloneArgs('https://example.com/x.git', '/tmp/d')).toEqual([
      '-c',
      'protocol.ext.allow=never',
      'clone',
      '--depth',
      '1',
      '--',
      'https://example.com/x.git',
      '/tmp/d',
    ]);
  });

  it('rejects sources that git would parse as options', () => {
    expect(() => gitCloneArgs('--upload-pack=evil.git', '/tmp/d')).toThrow(/Invalid source/);
  });
});
