import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';

const ID = /^[a-z][a-z0-9-]*$/;
const ENTRY_POINTS = { renderers: 'renderers/index.ts', dashboards: 'dashboards/index.ts' };

export interface ExtensionInfo {
  id: string;
  renderers: boolean;
  dashboards: boolean;
}

function assertId(id: string): void {
  if (!ID.test(id))
    throw new Error(`Invalid extension id "${id}" (use lowercase letters, digits, -)`);
}

function contributions(dir: string): Pick<ExtensionInfo, 'renderers' | 'dashboards'> {
  return {
    renderers: existsSync(join(dir, ENTRY_POINTS.renderers)),
    dashboards: existsSync(join(dir, ENTRY_POINTS.dashboards)),
  };
}

/** Argv for a shallow `git clone` of `source` into `dest` (never via git's
 *  `ext::` transport, which runs commands). Rejects sources that
 *  start with `-` (git would parse them as options), and ends option parsing
 *  with `--`. */
export function gitCloneArgs(source: string, dest: string): string[] {
  if (source.startsWith('-')) throw new Error(`Invalid source "${source}"`);
  return ['-c', 'protocol.ext.allow=never', 'clone', '--depth', '1', '--', source, dest];
}

function idOf(source: string): string {
  const manifest = join(source, 'extension.json');
  if (existsSync(manifest)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(manifest, 'utf8'));
    } catch (e) {
      throw new Error(`Invalid ${manifest}: ${(e as Error).message}`, { cause: e });
    }
    const id = (parsed as { id?: unknown } | null)?.id;
    if (typeof id === 'string') return id;
  }
  return basename(resolve(source));
}

type Messages = Record<string, string>;

/** `<dir>/messages/<locale>.json` files an extension ships, as locale -> messages. */
function shippedMessages(dir: string): Map<string, Messages> {
  const out = new Map<string, Messages>();
  const folder = join(dir, 'messages');
  if (!existsSync(folder)) return out;
  for (const f of readdirSync(folder)) {
    if (!f.endsWith('.json')) continue;
    out.set(f.slice(0, -'.json'.length), JSON.parse(readFileSync(join(folder, f), 'utf8')));
  }
  return out;
}

function writeMessages(file: string, messages: Messages): void {
  writeFileSync(file, JSON.stringify(messages, null, 2) + '\n');
}

/** Add an extension's message keys to the app's `<messagesDir>/<locale>.json` (locales the app
 *  lacks are skipped). Refuses a key the app already defines with different text. */
function mergeMessages(extDir: string, messagesDir: string): void {
  for (const [locale, shipped] of shippedMessages(extDir)) {
    const file = join(messagesDir, `${locale}.json`);
    if (!existsSync(file)) continue;
    const app = JSON.parse(readFileSync(file, 'utf8')) as Messages;
    for (const [key, text] of Object.entries(shipped)) {
      if (key in app && app[key] !== text) {
        throw new Error(`Message "${key}" (${locale}) already exists with different text`);
      }
      app[key] = text;
    }
    writeMessages(file, app);
  }
}

/** Remove the message keys an installed extension shipped from the app's locale files. */
function unmergeMessages(extDir: string, messagesDir: string): void {
  for (const [locale, shipped] of shippedMessages(extDir)) {
    const file = join(messagesDir, `${locale}.json`);
    if (!existsSync(file)) continue;
    const app = JSON.parse(readFileSync(file, 'utf8')) as Messages;
    for (const key of Object.keys(shipped)) delete app[key];
    writeMessages(file, app);
  }
}

/** Resolve `sub` inside the cloned/local `source`, refusing paths that escape it. */
export function resolveSubdir(source: string, sub: string | undefined): string {
  if (!sub) return source;
  const dir = resolve(source, sub);
  const rel = relative(resolve(source), dir);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`--path "${sub}" must stay inside the source`);
  }
  return dir;
}

/** Copy an extension folder into `root/<id>`. If `opts.messagesDir` is set, the extension's
 *  `messages/<locale>.json` keys are merged into that app messages folder. */
export function installExtension(
  source: string,
  root: string,
  opts: { force?: boolean; messagesDir?: string } = {},
): { id: string; replaced: boolean } {
  if (!existsSync(source)) throw new Error(`Source not found: ${source}`);
  const id = idOf(source);
  assertId(id);
  const found = contributions(source);
  if (!found.renderers && !found.dashboards) {
    throw new Error(
      `Not an extension: expected ${ENTRY_POINTS.renderers} or ${ENTRY_POINTS.dashboards} in ${source}`,
    );
  }
  const target = join(root, id);
  const replaced = existsSync(target);
  if (replaced && !opts.force) {
    throw new Error(`Extension "${id}" is already installed (use --force to replace it)`);
  }
  mkdirSync(root, { recursive: true });
  if (replaced) {
    if (opts.messagesDir) unmergeMessages(target, opts.messagesDir);
    rmSync(target, { recursive: true, force: true });
  }
  cpSync(source, target, {
    recursive: true,
    // Never copy VCS/dependency folders, or symlinks (they could point outside the extension).
    filter: (path) =>
      path === source ||
      (!['.git', 'node_modules'].includes(basename(path)) && !lstatSync(path).isSymbolicLink()),
  });
  if (opts.messagesDir) mergeMessages(target, opts.messagesDir);
  return { id, replaced };
}

/** Delete `root/<id>`. */
export function uninstallExtension(
  id: string,
  root: string,
  opts: { messagesDir?: string } = {},
): void {
  assertId(id);
  const target = join(root, id);
  if (!existsSync(target)) throw new Error(`Extension "${id}" is not installed`);
  if (opts.messagesDir) unmergeMessages(target, opts.messagesDir);
  rmSync(target, { recursive: true, force: true });
}

/** Installed extensions: folders in `root` that expose a renderers or dashboards entry point. */
export function listExtensions(root: string): ExtensionInfo[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && ID.test(e.name))
    .map((e) => ({ id: e.name, ...contributions(join(root, e.name)) }))
    .filter((e) => e.renderers || e.dashboards)
    .sort((a, b) => a.id.localeCompare(b.id));
}
