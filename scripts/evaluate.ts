import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { runEvaluation, runPhase } from './evaluation/run.js';

const args = process.argv.slice(2);
if (args.length && (args.length !== 1 || args[0] !== '--demo'))
  throw new Error('Usage: npm run evaluate [-- --demo]');
if (!args.length) {
  console.log(JSON.stringify(runEvaluation(), null, 2));
} else {
  if (!existsSync(resolve('dist/index.html')))
    throw new Error('Run npm run build or npm run evaluate:demo first');
  const base = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Ripple');
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'ripple-evaluation-'));
  runPhase('prepare', directory);
  console.log(
    'Prepared real-document evaluation; hypothetical migration and AI-curated labels, not human-reviewed.',
  );
  console.log(`Preserved evaluation directory: ${directory}`);
  console.log(
    'Select the Synchronous database owner proposal in Change to explore. Ctrl+C stops this owner; the evaluation store is retained.',
  );
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', resolve('server/index.ts'), '--production'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        RIPPLE_DB_PATH: join(directory, 'db'),
        PORT: process.env.PORT || '4322',
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
