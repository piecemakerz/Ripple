import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function runPhase(mode: 'write' | 'read' | 'prepare', directory: string) {
  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', fileURLToPath(new URL('./worker.ts', import.meta.url)), mode, directory],
    {
      encoding: 'utf8',
      timeout: 30000,
    },
  );
  if (child.status !== 0)
    throw new Error(
      child.stderr || child.stdout || child.error?.message || 'Evaluation worker failed',
    );
  return JSON.parse(child.stdout.trim()) as {
    ok: boolean;
    phase: string;
    scores: { passed: boolean }[];
  };
}
export function runEvaluation() {
  // Ignore RIPPLE_DB_PATH and .env. Only this newly allocated directory can be removed.
  const directory = mkdtempSync(join(tmpdir(), 'ripple-evaluation-'));
  try {
    const phases = [runPhase('write', directory), runPhase('read', directory)];
    if (!phases.every((p) => p.ok && p.scores.every((s) => s.passed)))
      throw new Error('Evaluation failed');
    return {
      ok: true,
      engine: 'native Relate 1.0.1',
      phases,
      restart: 'passed',
      liveDatabaseOpened: false,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
  }
}
