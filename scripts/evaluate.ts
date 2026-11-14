import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { runEvaluation, runPhase, runSuite } from './evaluation/run.js';
import { loadCase } from './evaluation/case.js';
import { parseEvaluationArgs } from './evaluation/cli.js';

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
  console.log(`Prepared ${fixture.id}: ${fixture.provenance}`);
  console.log(`Preserved evaluation directory: ${directory}`);
  console.log(
    `Select ${fixture.items.find((i) => i.key === fixture.proposal.target)!.title} in Change to explore. Ctrl+C stops this owner; the evaluation store is retained.`,
  );
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', resolve('server/index.ts'), '--production'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        RIPPLE_DB_PATH: join(directory, 'db'),
        PORT: process.env.PORT || (caseName === 'semver-deprecation' ? '4323' : '4322'),
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
