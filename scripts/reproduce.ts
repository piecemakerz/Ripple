// Fresh install/check in a new temporary checkout; does not touch the live DB or current node_modules.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = mkdtempSync(join(tmpdir(), 'ripple-reproduce-'));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run reproduce');
function copy(source: string, destination: string) {
  // Node 22.17.1 fs.cpSync(directory) crashed on this Windows OneDrive host.
  // Walk explicitly and use copyFileSync; all inputs are repository-owned source paths.
  if (statSync(source).isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source)) copy(join(source, entry), join(destination, entry));
  } else copyFileSync(source, destination);
}
try {
  for (const path of [
    '.prettierrc.json',
    '.prettierignore',
    '.agents',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'index.html',
    'public',
    'src',
    'shared',
    'server',
    'scripts',
    'tests',
  ])
    copy(resolve(path), join(directory, path));
  console.log(`Clean checkout: ${directory}`);
  for (const args of [['ci'], ['run', 'verify'], ['run', 'doctor']]) {
    const child = spawnSync(process.execPath, [npmCli, ...args], {
      cwd: directory,
      stdio: 'inherit',
      timeout: 180000,
    });
    if (child.status !== 0)
      throw new Error(`npm ${args.join(' ')} failed: ${child.error?.message ?? child.status}`);
  }
  console.log('PASS: clean npm ci, verification and native persistence doctor.');
} finally {
  // Only the freshly allocated mkdtemp directory is eligible for cleanup.
  rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
}
