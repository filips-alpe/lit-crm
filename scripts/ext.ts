import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  gitCloneArgs,
  installExtension,
  listExtensions,
  resolveSubdir,
  uninstallExtension,
} from './extensions/lib';

const ROOT = resolve(import.meta.dirname, '../src/extensions');
const APP = resolve(import.meta.dirname, '..');
const MESSAGES = resolve(import.meta.dirname, '../messages');
const ROUTES = resolve(import.meta.dirname, '../src/routes/(app)/x');
const USAGE = `Usage: bun run ext <command>

  install <path|git-url> [--path <subdir>] [--force]
                                     copy an extension into src/extensions/<id>, its routes/
                                     folder into src/routes/(app)/x/<id> (served at /x/<id>/...),
                                     and merge its messages/<locale>.json keys into messages/
                                     (--path: the extension lives in <subdir> of the source)
  uninstall <id>                     remove src/extensions/<id>, its routes and message keys
  list                               show installed extensions

Extensions are code that runs in the app: only install ones you trust.`;

/** Recompile the paraglide messages (same project/outdir as the vite plugin) so type checks
 *  and the dev server see the changed message keys straight away. */
function compileMessages(): void {
  execFileSync(
    join(APP, 'node_modules/.bin/paraglide-js'),
    ['compile', '--project', './project.inlang', '--outdir', './src/lib/paraglide', '--silent'],
    { cwd: APP, stdio: 'inherit' },
  );
}

const isGit = (s: string) => /^(https?:\/\/|git@|ssh:\/\/)/.test(s) || s.endsWith('.git');

function install(source: string, force: boolean, sub?: string): void {
  let dir = resolve(source);
  let tmp: string | null = null;
  if (isGit(source)) {
    tmp = mkdtempSync(join(tmpdir(), 'ext-clone-'));
    execFileSync('git', gitCloneArgs(source, tmp), { stdio: 'inherit' });
    dir = tmp;
  }
  try {
    const { id, replaced } = installExtension(resolveSubdir(dir, sub), ROOT, {
      force,
      messagesDir: MESSAGES,
      routesDir: ROUTES,
    });
    compileMessages();
    console.log(`${replaced ? 'Replaced' : 'Installed'} "${id}" in src/extensions/${id}`);
    console.log('Set `rendererId` on any types that should use its renderers, then restart dev.');
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  const [cmd, arg, ...rest] = process.argv.slice(2);
  const pathIdx = rest.indexOf('--path');
  if (pathIdx >= 0 && !rest[pathIdx + 1]) throw new Error('--path needs a subdirectory');
  if (cmd === 'install' && arg) {
    install(arg, rest.includes('--force'), pathIdx >= 0 ? rest[pathIdx + 1] : undefined);
  } else if (cmd === 'uninstall' && arg) {
    uninstallExtension(arg, ROOT, { messagesDir: MESSAGES, routesDir: ROUTES });
    compileMessages();
    console.log(`Removed "${arg}". Types that named its renderers fall back to the default view.`);
  } else if (cmd === 'list') {
    const found = listExtensions(ROOT, { routesDir: ROUTES });
    if (!found.length) console.log('No extensions installed.');
    for (const { id, ...parts } of found) {
      const names = Object.entries(parts).flatMap(([k, v]) => (v ? [k] : []));
      console.log(`${id.padEnd(20)} ${names.join(', ')}`);
    }
  } else {
    console.log(USAGE);
    process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
