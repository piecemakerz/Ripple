import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCase, type CaseName } from './evaluation/case.js';
import { runPhase } from './evaluation/run.js';

export const judgeCase = 'semver-deprecation';
const manifestName = 'ripple-judge.json';
type FileDigest = { path: string; bytes: number; sha256: string };
export function inventory(directory: string, prefix = ''): FileDigest[] {
  const result: FileDigest[] = [];
  for (const name of readdirSync(join(directory, prefix)).sort()) {
    const relative = prefix ? `${prefix}/${name}` : name;
    const file = join(directory, relative);
    const stat = lstatSync(file);
    assert.ok(!stat.isSymbolicLink(), `Refusing symbolic link: ${relative}`);
    if (stat.isDirectory()) result.push(...inventory(directory, relative));
    else {
      assert.ok(stat.isFile(), `Unexpected entry: ${relative}`);
      const bytes = readFileSync(file);
      result.push({
        path: relative,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
  return result;
}

// Explicit walk avoids this host's Node 22.17.1 fs.cpSync(directory) native crash.
export function copyTree(source: string, destination: string) {
  const stat = lstatSync(source);
  assert.ok(!stat.isSymbolicLink(), 'Refusing symbolic-link source');
  if (stat.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source)) copyTree(join(source, name), join(destination, name));
  } else {
    assert.ok(stat.isFile(), 'Expected a regular source file');
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
}

export function checkJudgeSnapshot(directory: string) {
  const manifest = JSON.parse(readFileSync(join(directory, manifestName), 'utf8'));
  const { fixture, fixtureHash } = loadCase(manifest.caseName ?? judgeCase);
  assert.equal(manifest.format, 'ripple-judge-v1', 'Not a Ripple judge bundle');
  assert.equal(manifest.caseId, fixture.id, 'Judge case mismatch');
  assert.equal(manifest.fixtureSha256, fixtureHash, 'Judge fixture mismatch');
  assert.deepEqual(
    inventory(join(directory, 'snapshot')),
    manifest.snapshot,
    'Frozen snapshot hash mismatch',
  );
  return manifest;
}

export function inspectJudgeSnapshot(directory: string) {
  const manifest = checkJudgeSnapshot(directory);
  // Only the verified frozen artifact is copied. Never open a supplied live-store path.
  const scratch = mkdtempSync(join(tmpdir(), 'ripple-judge-inspect-'));
  try {
    copyTree(join(directory, 'snapshot'), scratch);
    const before = inventory(scratch);
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        fileURLToPath(new URL('./judge-inspect.ts', import.meta.url)),
        scratch,
        manifest.caseName ?? judgeCase,
      ],
      { encoding: 'utf8', timeout: 30000 },
    );
    if (child.status !== 0)
      throw new Error(
        child.stderr || child.stdout || child.error?.message || 'Judge inspection failed',
      );
    assert.deepEqual(
      inventory(scratch),
      before,
      'Read-only inspection changed the copied snapshot',
    );
    checkJudgeSnapshot(directory);
    return JSON.parse(child.stdout.trim()) as {
      ok: boolean;
      readOnly: boolean;
      impactedItems: number;
      paths: string[];
      evidence: { quote: string; sourceTitle: string; start: number; end: number }[];
      savedReview: { status: string; reason: string };
      changeId: string;
      selectedItemId: string;
    };
  } finally {
    // Only the exact mkdtemp directory allocated above is removed, after worker exit.
    rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
  }
}

export function prepareJudgeSnapshot(base: string, caseName: CaseName = judgeCase) {
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'ripple-judge-'));
  const writer = mkdtempSync(join(tmpdir(), 'ripple-evaluation-'));
  try {
    const validation = runPhase('write', writer, caseName);
    // runPhase is synchronous: the only writer has exited before copying native files.
    copyTree(writer, join(directory, 'snapshot'));
    const { fixture, fixtureHash } = loadCase(caseName);
    writeFileSync(
      join(directory, manifestName),
      JSON.stringify(
        {
          format: 'ripple-judge-v1',
          createdAt: new Date().toISOString(),
          caseId: fixture.id,
          caseName,
          fixtureSha256: fixtureHash,
          engine: 'native Relate 1.0.1',
          storage: 'persistent directory',
          provenance: fixture.provenance,
          humanValidated: false,
          snapshot: inventory(join(directory, 'snapshot')),
        },
        null,
        2,
      ),
    );
    writeFileSync(join(directory, 'preparation.json'), JSON.stringify(validation, null, 2));
    const inspection = inspectJudgeSnapshot(directory);
    writeFileSync(join(directory, 'inspection.json'), JSON.stringify(inspection, null, 2));
    return { directory, inspection };
  } finally {
    rmSync(writer, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
  }
}

export function copyJudgeSource(root: string, destination: string) {
  // Public project inputs only. No .git, .env, node_modules, live DB, .runtime or dist.
  for (const path of [
    '.env.example',
    '.agents',
    '.github',
    '.gitattributes',
    '.gitignore',
    '.prettierignore',
    '.prettierrc.json',
    'AGENTS.md',
    'LICENSE',
    'README.md',
    'THIRD_PARTY.md',
    'design-qa.md',
    'docs',
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
    'evaluation',
  ])
    copyTree(resolve(root, path), join(destination, path));
  return inventory(destination);
}
