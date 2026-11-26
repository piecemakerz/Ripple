import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { runEvaluation, runPhase, runSuite } from './evaluation/run.js';
import { loadCase } from './evaluation/case.js';
import { parseEvaluationArgs } from './evaluation/cli.js';
import { entryUrl } from '../shared/entry-link.js';
import type { PreparedCase } from './evaluation/prepare.js';

const { demo, caseName } = parseEvaluationArgs(process.argv.slice(2));
if (!demo) {
  console.log(JSON.stringify(caseName ? runEvaluation(caseName) : runSuite(), null, 2));
} else {
  const { fixture } = loadCase(caseName);
  if (!existsSync(resolve('dist/index.html')))
    throw new Error('Run npm run build or npm run evaluate:demo first');
  const base = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Ripple');
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'ripple-evaluation-'));
  runPhase('prepare', directory, caseName);
  const prepared = JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8')) as PreparedCase;
  const port =
    process.env.PORT ||
    (caseName === 'ripple-review-contract'
      ? '4326'
      : caseName === 'semver-deprecation'
        ? '4323'
        : '4322');
  const url = entryUrl(
    `http://127.0.0.1:${port}/`,
    `proposal:${prepared.proposal.id}`,
    prepared.items[fixture.review.item],
  );
  console.log(`Prepared ${fixture.id}: ${fixture.provenance}`);
  console.log(`Preserved evaluation directory: ${directory}`);
  console.log(
    `Open this case directly: ${url.href}\nCtrl+C stops this owner; the evaluation store is retained.`,
  );
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', resolve('server/index.ts'), '--production'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        RIPPLE_DB_PATH: join(directory, 'db'),
        PORT: port,
      },
    },
  );
  child.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}
