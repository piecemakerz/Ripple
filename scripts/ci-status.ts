// Read-only status of the public repository; no credentials or model APIs are used.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = git('rev-parse', 'HEAD');
assert.match(sha, /^[a-f0-9]{40}$/);
const dirty = git('status', '--porcelain').length > 0;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  repository: { url: string };
};
const url = new URL(pkg.repository.url);
assert.equal(url.origin, 'https://github.com');
const repository = url.pathname.replace(/^\//, '').replace(/\.git$/, '');
assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
const response = await fetch(
  `https://api.github.com/repos/${repository}/actions/workflows/verify.yml/runs?head_sha=${sha}&per_page=100`,
  {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Ripple-CI-status' },
    signal: AbortSignal.timeout(15000),
  },
);
if (!response.ok) throw new Error(`GitHub status request failed: HTTP ${response.status}`);
type Run = {
  id: number;
  head_sha: string;
  status: string;
  conclusion: string | null;
  html_url: string;
};
const payload = (await response.json()) as { workflow_runs: Run[] };
assert.ok(Array.isArray(payload.workflow_runs), 'Unexpected GitHub response');
const run = payload.workflow_runs
  .filter((entry) => entry.head_sha === sha)
  .sort((a, b) => b.id - a.id)[0];
const state =
  !run || run.status !== 'completed'
    ? 'pending'
    : run.conclusion === 'success'
      ? 'passed'
      : 'failed';
console.log(
  JSON.stringify(
    {
      repository,
      commit: sha,
      workingTreeDirty: dirty,
      state,
      conclusion: run?.conclusion ?? null,
      runUrl: run?.html_url ?? null,
      note: dirty
        ? 'CI covers the committed HEAD only; uncommitted edits are not covered.'
        : undefined,
    },
    null,
    2,
  ),
);
process.exitCode = state === 'passed' ? 0 : state === 'pending' ? 2 : 1;
