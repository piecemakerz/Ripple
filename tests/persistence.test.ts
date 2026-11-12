import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const mode of ['checkpoint', 'wal'] as const) {
  test(`separate processes restore graph, change, review, history and rollback (${mode})`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'ripple-restart-test-'));
    try {
      for (const step of mode === 'checkpoint' ? ['write', 'read'] : ['wal-write', 'wal-read']) {
        const child = spawnSync(
          process.execPath,
          [
            '--import',
            'tsx',
            resolve('scripts/persistence-worker.ts'),
            step,
            join(directory, 'db'),
          ],
          { encoding: 'utf8', timeout: 30000 },
        );
        assert.equal(child.status, 0, child.stderr || child.stdout);
        assert.equal(JSON.parse(child.stdout.trim()).ok, true);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
