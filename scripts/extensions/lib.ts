import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';

const ID = /^[a-z][a-z0-9-]*$/;
/** Files (or, for `routes`, a folder) whose presence makes a folder an extension. */
const ENTRY_POINTS = {
  renderers: 'renderers/index.ts',
  dashboards: 'dashboards/index.ts',
  routes: 'routes',
  nav: 'nav.ts',
  recordActions: 'recordActions.ts',
  shell: 'shell/index.ts',
} as const;
type Contribution = keyof typeof ENTRY_POINTS;

export type ExtensionInfo = { id: string } & Record<Contribution, boolean>;

/** An extension's `routes/` folder is installed as `<routesDir>/<id>`: plain SvelteKit routes,
 *  served under `/x/<id>/...` when `routesDir` is `src/routes/(app)/x`. */
const ROUTES = ENTRY_POINTS.routes;

function assertId(id: string): void {
  if (!ID.test(id))
    throw new Error(`Invalid extension id "${id}" (use lowercase letters, digits, -)`);
}

function contributions(dir: string): Record<Contribution, boolean> {
  return Object.fromEntries(
    Object.entries(ENTRY_POINTS).map(([k, file]) => [k, existsSync(join(dir, file))]),
  ) as Record<Contribution, boolean>;
}

const contributesAnything = (found: Record<Contribution, boolean>) =>
  Object.values(found).some(Boolean);

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

/** Record, inside an installed extension folder, of the message keys the install added
 *  (locale -> keys). Keys the app already had with identical text are not listed. */
const ADDED_FILE = '.messages-added.json';
type Added = Record<string, string[]>;

function readAdded(extDir: string): Added {
  const f = join(extDir, ADDED_FILE);
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(readFileSync(f, 'utf8')) as Added;
  } catch {
    return {};
  }
}

/** Compute (without writing) the new `<messagesDir>/<locale>.json` contents after removing the
 *  keys `previous` added and adding the keys `shipped` ships (locales the app lacks are skipped).
 *  Throws on a key the app defines with different text. Returns the files to write and the
 *  keys actually added. */
function planMessages(
  shipped: Map<string, Messages>,
  previous: Added,
  messagesDir: string,
): { writes: Map<string, Messages>; added: Added } {
  const writes = new Map<string, Messages>();
  const added: Added = {};
  const locales = new Set([...shipped.keys(), ...Object.keys(previous)]);
  for (const locale of locales) {
    const file = join(messagesDir, `${locale}.json`);
    if (!existsSync(file)) continue;
    const app = JSON.parse(readFileSync(file, 'utf8')) as Messages;
    for (const key of previous[locale] ?? []) delete app[key];
    for (const [key, text] of Object.entries(shipped.get(locale) ?? {})) {
      if (key in app) {
        if (app[key] !== text) {
          throw new Error(`Message "${key}" (${locale}) already exists with different text`);
        }
        continue;
      }
      app[key] = text;
      (added[locale] ??= []).push(key);
    }
    writes.set(file, app);
  }
  return { writes, added };
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
  opts: { force?: boolean; messagesDir?: string; routesDir?: string } = {},
): { id: string; replaced: boolean } {
  if (!existsSync(source)) throw new Error(`Source not found: ${source}`);
  const id = idOf(source);
  assertId(id);
  const found = contributions(source);
  if (!contributesAnything(found)) {
    throw new Error(
      `Not an extension: expected one of ${Object.values(ENTRY_POINTS).join(', ')} in ${source}`,
    );
  }
  const target = join(root, id);
  const replaced = existsSync(target);
  if (replaced && !opts.force) {
    throw new Error(`Extension "${id}" is already installed (use --force to replace it)`);
  }
  const routesTarget = opts.routesDir ? join(opts.routesDir, id) : null;
  if (found.routes && !routesTarget)
    throw new Error(`Extension "${id}" ships routes: set routesDir`);
  if (routesTarget && existsSync(routesTarget) && !replaced) {
    throw new Error(`${routesTarget} already exists and is not an installed extension's`);
  }
  // Validate and merge every locale in memory first, so a conflict leaves the tree untouched.
  const plan = opts.messagesDir
    ? planMessages(shippedMessages(source), replaced ? readAdded(target) : {}, opts.messagesDir)
    : null;
  mkdirSync(root, { recursive: true });
  const staging = mkdtempSync(join(root, `.install-${id}-`));
  let routesStaging: string | null = null;
  try {
    cpSync(source, staging, {
      recursive: true,
      // Never copy VCS/dependency folders, or symlinks (they could point outside the extension).
      filter: (path) =>
        path === source ||
        (!['.git', 'node_modules'].includes(basename(path)) && !lstatSync(path).isSymbolicLink()),
    });
    rmSync(join(staging, ADDED_FILE), { force: true });
    if (plan && Object.keys(plan.added).length) {
      writeFileSync(join(staging, ADDED_FILE), JSON.stringify(plan.added, null, 2) + '\n');
    }
    // The routes leave the extension folder for the app's routes tree, so SvelteKit serves them
    // natively (loads, actions, endpoints, layouts, `./$types`). They are moved, not copied:
    // there is one place to edit them.
    const stagedRoutes = join(staging, ROUTES);
    if (routesTarget && existsSync(stagedRoutes)) {
      // Staged beside the extension (same filesystem), outside the routes tree SvelteKit watches.
      routesStaging = `${staging}.routes`;
      renameSync(stagedRoutes, routesStaging);
    }
    rmSync(target, { recursive: true, force: true });
    renameSync(staging, target);
    if (routesTarget) {
      rmSync(routesTarget, { recursive: true, force: true });
      if (routesStaging) {
        mkdirSync(opts.routesDir!, { recursive: true });
        renameSync(routesStaging, routesTarget);
      }
    }
  } catch (e) {
    rmSync(staging, { recursive: true, force: true });
    if (routesStaging) rmSync(routesStaging, { recursive: true, force: true });
    throw e;
  }
  if (plan) for (const [file, messages] of plan.writes) writeMessages(file, messages);
  return { id, replaced };
}

/** Delete `root/<id>`. */
export function uninstallExtension(
  id: string,
  root: string,
  opts: { messagesDir?: string; routesDir?: string } = {},
): void {
  assertId(id);
  const target = join(root, id);
  if (!existsSync(target)) throw new Error(`Extension "${id}" is not installed`);
  if (opts.routesDir) rmSync(join(opts.routesDir, id), { recursive: true, force: true });
  if (opts.messagesDir) {
    const { writes } = planMessages(new Map(), readAdded(target), opts.messagesDir);
    for (const [file, messages] of writes) writeMessages(file, messages);
  }
  rmSync(target, { recursive: true, force: true });
}

/** Installed extensions: folders in `root` that expose an entry point (routes: `routesDir/<id>`). */
export function listExtensions(root: string, opts: { routesDir?: string } = {}): ExtensionInfo[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && ID.test(e.name))
    .flatMap((e) => {
      const found = contributions(join(root, e.name));
      found.routes = !!opts.routesDir && existsSync(join(opts.routesDir, e.name));
      return contributesAnything(found) ? [{ id: e.name, ...found }] : [];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
