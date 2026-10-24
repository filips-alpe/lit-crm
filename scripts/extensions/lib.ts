import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';

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

/** Copy an extension folder into `root/<id>`. */
export function installExtension(
  source: string,
  root: string,
  opts: { force?: boolean } = {},
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
  if (replaced) rmSync(target, { recursive: true, force: true });
  cpSync(source, target, {
    recursive: true,
    // Never copy VCS/dependency folders, or symlinks (they could point outside the extension).
    filter: (path) =>
      path === source ||
      (!['.git', 'node_modules'].includes(basename(path)) && !lstatSync(path).isSymbolicLink()),
  });
  return { id, replaced };
}

/** Delete `root/<id>`. */
export function uninstallExtension(id: string, root: string): void {
  assertId(id);
  const target = join(root, id);
  if (!existsSync(target)) throw new Error(`Extension "${id}" is not installed`);
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
