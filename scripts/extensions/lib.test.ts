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
import { readFileSync } from 'node:fs';
import {
  gitCloneArgs,
  installExtension,
  listExtensions,
  resolveSubdir,
  uninstallExtension,
} from './lib';

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

  it('refuses a folder with no entry point', () => {
    const src = makeSource('z', { 'extension.json': '{"id":"z"}', 'readme.md': '' });
    expect(() => installExtension(src, root)).toThrow(/Not an extension/);
  });

  it('accepts an extension with only nav, record actions or a shell', () => {
    for (const file of ['nav.ts', 'recordActions.ts', 'shell/index.ts']) {
      const id = file.replace(/\W/g, '').toLowerCase();
      const src = makeSource(id, { 'extension.json': `{"id":"${id}"}`, [file]: '' });
      expect(installExtension(src, root).id).toBe(id);
    }
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
    const none = {
      renderers: false,
      dashboards: false,
      routes: false,
      nav: false,
      recordActions: false,
      shell: false,
    };
    expect(listExtensions(root)).toEqual([
      { ...none, id: 'a', renderers: true },
      { ...none, id: 'b', renderers: true, dashboards: true },
    ]);
  });
});

describe('extension routes', () => {
  let routesDir: string;
  beforeEach(() => {
    routesDir = join(work, 'routes-x');
  });
  const withRoutes = (page = '<h1>Hi</h1>') =>
    makeSource('r', {
      'extension.json': '{"id":"r"}',
      'routes/+page.svelte': page,
      'routes/items/[id]/+page.server.ts': 'export const load = () => ({});',
      'routes/api/ping/+server.ts': 'export const GET = () => new Response("ok");',
    });

  it('moves routes/ into <routesDir>/<id>, out of the extension folder', () => {
    installExtension(withRoutes(), root, { routesDir });
    expect(existsSync(join(routesDir, 'r/+page.svelte'))).toBe(true);
    expect(existsSync(join(routesDir, 'r/items/[id]/+page.server.ts'))).toBe(true);
    expect(existsSync(join(routesDir, 'r/api/ping/+server.ts'))).toBe(true);
    expect(existsSync(join(root, 'r/routes'))).toBe(false);
    expect(readdirSync(work).filter((f) => f.includes('.install-'))).toEqual([]);
    expect(listExtensions(root, { routesDir })[0]).toMatchObject({ id: 'r', routes: true });
  });

  it('replaces the routes on a forced reinstall, dropping removed files', () => {
    installExtension(withRoutes(), root, { routesDir });
    const v2 = makeSource('r2', { 'extension.json': '{"id":"r"}', 'routes/+page.svelte': 'v2' });
    installExtension(v2, root, { routesDir, force: true });
    expect(readFileSync(join(routesDir, 'r/+page.svelte'), 'utf8')).toBe('v2');
    expect(existsSync(join(routesDir, 'r/items'))).toBe(false);
  });

  it('removes the routes when an update ships none', () => {
    installExtension(withRoutes(), root, { routesDir });
    const v2 = makeSource('r3', { 'extension.json': '{"id":"r"}', 'nav.ts': '' });
    installExtension(v2, root, { routesDir, force: true });
    expect(existsSync(join(routesDir, 'r'))).toBe(false);
  });

  it('refuses to overwrite a routes folder no installed extension owns', () => {
    mkdirSync(join(routesDir, 'r'), { recursive: true });
    expect(() => installExtension(withRoutes(), root, { routesDir })).toThrow(/already exists/);
    expect(existsSync(join(root, 'r'))).toBe(false);
  });

  it('refuses an extension with routes when no routesDir is given', () => {
    expect(() => installExtension(withRoutes(), root)).toThrow(/routesDir/);
  });

  it('uninstall removes the routes too', () => {
    installExtension(withRoutes(), root, { routesDir });
    uninstallExtension('r', root, { routesDir });
    expect(existsSync(join(routesDir, 'r'))).toBe(false);
    expect(existsSync(join(root, 'r'))).toBe(false);
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

describe('resolveSubdir', () => {
  it('returns the source itself without a subdirectory', () => {
    expect(resolveSubdir('/a/b', undefined)).toBe('/a/b');
  });

  it('resolves a subdirectory inside the source', () => {
    expect(resolveSubdir('/a/b', 'extension')).toBe('/a/b/extension');
  });

  it('refuses paths that escape the source', () => {
    expect(() => resolveSubdir('/a/b', '../c')).toThrow(/inside the source/);
    expect(() => resolveSubdir('/a/b', '/etc')).toThrow(/inside the source/);
  });
});

describe('extension messages', () => {
  let messagesDir: string;
  const read = (locale: string) =>
    JSON.parse(readFileSync(join(messagesDir, `${locale}.json`), 'utf8'));
  const withMessages = (en: object, lv?: object) =>
    makeSource('m', {
      'extension.json': '{"id":"m"}',
      'renderers/index.ts': '',
      'messages/en.json': JSON.stringify(en),
      ...(lv ? { 'messages/lv.json': JSON.stringify(lv) } : {}),
      'messages/de.json': '{"k":"x"}',
    });

  beforeEach(() => {
    messagesDir = join(work, 'messages');
    mkdirSync(messagesDir);
    writeFileSync(join(messagesDir, 'en.json'), JSON.stringify({ own: 'Own' }));
    writeFileSync(join(messagesDir, 'lv.json'), JSON.stringify({ own: 'Savs' }));
  });

  it('merges shipped keys into the locales the app has, and skips the others', () => {
    installExtension(withMessages({ k: 'K' }, { k: 'Ka' }), root, { messagesDir });
    expect(read('en')).toEqual({ own: 'Own', k: 'K' });
    expect(read('lv')).toEqual({ own: 'Savs', k: 'Ka' });
    expect(existsSync(join(messagesDir, 'de.json'))).toBe(false);
  });

  it('refuses a key the app already has with different text', () => {
    expect(() => installExtension(withMessages({ own: 'Other' }), root, { messagesDir })).toThrow(
      /"own".*different text/,
    );
  });

  it('replaces its own keys on --force and removes them on uninstall', () => {
    installExtension(withMessages({ k: 'K' }), root, { messagesDir });
    const v2 = withMessages({ k: 'K2' });
    installExtension(v2, root, { messagesDir, force: true });
    expect(read('en')).toEqual({ own: 'Own', k: 'K2' });
    uninstallExtension('m', root, { messagesDir });
    expect(read('en')).toEqual({ own: 'Own' });
  });

  it('is atomic: a conflict in a later locale leaves the tree unchanged', () => {
    const before = { en: read('en'), lv: read('lv') };
    const bytes = readFileSync(join(messagesDir, 'en.json'), 'utf8');
    expect(() =>
      installExtension(withMessages({ k: 'K' }, { own: 'Cits' }), root, { messagesDir }),
    ).toThrow(/"own" \(lv\)/);
    expect(readFileSync(join(messagesDir, 'en.json'), 'utf8')).toBe(bytes);
    expect({ en: read('en'), lv: read('lv') }).toEqual(before);
    expect(readdirSync(root)).toEqual([]);
  });

  it('keeps an existing install intact when a --force replace conflicts', () => {
    installExtension(withMessages({ k: 'K' }), root, { messagesDir });
    expect(() =>
      installExtension(withMessages({ own: 'Other' }), root, { messagesDir, force: true }),
    ).toThrow(/different text/);
    expect(read('en')).toEqual({ own: 'Own', k: 'K' });
    expect(existsSync(join(root, 'm/renderers/index.ts'))).toBe(true);
    uninstallExtension('m', root, { messagesDir });
    expect(read('en')).toEqual({ own: 'Own' });
  });

  it('uninstall keeps a key the app already had with identical text', () => {
    installExtension(withMessages({ own: 'Own', k: 'K' }), root, { messagesDir });
    expect(read('en')).toEqual({ own: 'Own', k: 'K' });
    uninstallExtension('m', root, { messagesDir });
    expect(read('en')).toEqual({ own: 'Own' });
  });

  it('uninstall leaves the locale files byte-identical to before install', () => {
    const before = readFileSync(join(messagesDir, 'en.json'), 'utf8');
    installExtension(withMessages({ own: 'Own', k: 'K' }, { k: 'Ka' }), root, { messagesDir });
    uninstallExtension('m', root, { messagesDir });
    const after = JSON.stringify(JSON.parse(before), null, 2) + '\n';
    expect(readFileSync(join(messagesDir, 'en.json'), 'utf8')).toBe(after);
  });

  it('leaves messages alone when no messagesDir is given', () => {
    installExtension(withMessages({ k: 'K' }), root);
    expect(read('en')).toEqual({ own: 'Own' });
  });
});
