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
const MESSAGES = resolve(import.meta.dirname, '../messages');
const USAGE = `Usage: bun run ext <command>

  install <path|git-url> [--path <subdir>] [--force]
                                     copy an extension into src/extensions/<id> and merge its
                                     messages/<locale>.json keys into messages/
                                     (--path: the extension lives in <subdir> of the source)
  uninstall <id>                     remove src/extensions/<id> and its message keys
  list                               show installed extensions

Extensions are code that runs in the app: only install ones you trust.`;

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
    });
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
    uninstallExtension(arg, ROOT, { messagesDir: MESSAGES });
    console.log(`Removed "${arg}". Types that named its renderers fall back to the default view.`);
  } else if (cmd === 'list') {
    const found = listExtensions(ROOT);
    if (!found.length) console.log('No extensions installed.');
    for (const e of found) {
      const parts = [e.renderers && 'renderers', e.dashboards && 'dashboards'].filter(Boolean);
      console.log(`${e.id.padEnd(20)} ${parts.join(', ')}`);
    }
  } else {
    console.log(USAGE);
    process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
