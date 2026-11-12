import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = mkdtempSync(join(tmpdir(), 'ripple-doctor-'));
console.log(`Node ${process.version} · ${process.platform}/${process.arch} · Relate 1.0.1`);
try {
  for (const mode of ['write', 'read']) {
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', resolve('scripts/persistence-worker.ts'), mode, join(directory, 'db')],
      { encoding: 'utf8', timeout: 30000 },
    );
    if (child.status !== 0) throw new Error(child.stderr || child.stdout || 'Relate worker failed');
    console.log(child.stdout.trim());
  }
  console.log(
    'PASS: native database, parameterized traversal, transaction rollback, process restart, preserved change and review history.',
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
