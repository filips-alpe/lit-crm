import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  gitCloneArgs,
  installExtension,
  listExtensions,
  uninstallExtension,
} from './extensions/lib';

const ROOT = resolve(import.meta.dirname, '../src/extensions');
const USAGE = `Usage: bun run ext <command>

  install <path|git-url> [--force]   copy an extension into src/extensions/<id>
  uninstall <id>                     remove src/extensions/<id>
  list                               show installed extensions

Extensions are code that runs in the app: only install ones you trust.`;

const isGit = (s: string) => /^(https?:\/\/|git@|ssh:\/\/)/.test(s) || s.endsWith('.git');

function install(source: string, force: boolean): void {
  let dir = resolve(source);
  let tmp: string | null = null;
  if (isGit(source)) {
    tmp = mkdtempSync(join(tmpdir(), 'ext-clone-'));
    execFileSync('git', gitCloneArgs(source, tmp), { stdio: 'inherit' });
    dir = tmp;
  }
  try {
    const { id, replaced } = installExtension(dir, ROOT, { force });
    console.log(`${replaced ? 'Replaced' : 'Installed'} "${id}" in src/extensions/${id}`);
    console.log('Set `rendererId` on any types that should use its renderers, then restart dev.');
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  const [cmd, arg, ...rest] = process.argv.slice(2);
  if (cmd === 'install' && arg) install(arg, rest.includes('--force'));
  else if (cmd === 'uninstall' && arg) {
    uninstallExtension(arg, ROOT);
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
