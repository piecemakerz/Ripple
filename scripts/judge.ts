import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { entryUrl } from '../shared/entry-link.js';
import { caseNames, type CaseName } from './evaluation/case.js';
import {
  copyJudgeSource,
  copyTree,
  inspectJudgeSnapshot,
  prepareJudgeSnapshot,
} from './judge-bundle.js';

const [mode, argument, ...extra] = process.argv.slice(2);
const caseName: CaseName =
  mode === 'prepare' && argument === '--case' && caseNames.includes(extra[0] as CaseName)
    ? (extra[0] as CaseName)
    : 'semver-deprecation';
if (
  !['prepare', 'inspect', 'start'].includes(mode) ||
  (mode === 'prepare'
    ? argument !== undefined &&
      (argument !== '--case' || extra.length !== 1 || !caseNames.includes(extra[0] as CaseName))
    : !argument || extra.length > 0)
)
  throw new Error(
    'Usage: npm run judge:prepare [-- --case NAME] | npm run judge:inspect -- BUNDLE | npm run judge:start -- BUNDLE',
  );
const base = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Ripple');
mkdirSync(base, { recursive: true });
if (mode === 'prepare') {
  const { directory, inspection } = prepareJudgeSnapshot(base, caseName);
  const files = copyJudgeSource(process.cwd(), join(directory, 'app'));
  let sourceCommit: string | null = null;
  let workingTreeDirty: boolean | null = null;
  try {
    sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    workingTreeDirty =
      execFileSync('git', ['status', '--porcelain'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().length > 0;
  } catch {
    /* A source ZIP can be used without Git metadata. */
  }
  writeFileSync(
    join(directory, 'source-manifest.json'),
    JSON.stringify(
      {
        sourceCommit,
        workingTreeDirty,
        files,
        note: 'File hashes identify these exact bytes. A dirty source tree is not covered by committed-HEAD CI.',
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(directory, 'JUDGE_README.md'),
    `# Ripple judge bundle\n\nLocal preparation only; not a published or submitted entry.\n\nThis package includes the current source in app/ and an immutable demonstration native Relate store in snapshot/db/. The source manifest records exact file hashes and whether it differs from the recorded Git commit. Native inspection found ${inspection.impactedItems} targets, ${inspection.paths.length} paths and ${inspection.evidence.length} original evidence records. This is regression evidence, not human validation.\n\n## Run on Windows x64 with Node 22.12+\n\nFrom this directory:\n\n\`\`\`powershell\ncd app\nnpm ci\nnpm run verify\nnpm run judge:inspect -- ..\nnpm run judge:start -- ..\n\`\`\`\n\nOpen the exact URL printed by judge:start. It starts a new working COPY of the saved case on loopback; the frozen store is never the writable server database. The saved decision is curator-authored fixture data, not independent feedback. Selected case: ${caseName}. To try the unapplied case, use npm run ${caseName === 'ripple-review-contract' ? 'evaluate:ripple:demo' : 'evaluate:semver:demo'} and its printed proposal URL.\n\nStop the owner with Ctrl+C before restarting. The printed working database path and URL can be reused with RIPPLE_DB_PATH and npm start. Each judge:start invocation creates a different working copy.\n\nInspect the files in snapshot/db and inspection.json. judge:inspect validates hashes, copies the frozen store to a temporary directory, reads it with native readOnly access in a separate process and verifies that no files changed. It never opens the user's live DB.\n\nAttribution and limits: app/THIRD_PARTY.md, app/docs/AI_DISCLOSURE.md and app/docs/HACKATHON_SUBMISSION.md. This bundle contains manual context and no runtime AI. It requires npm access for installation, and is verified on Windows x64 only.\n`,
  );
  console.log(
    JSON.stringify(
      {
        bundle: directory,
        snapshot: 'snapshot/db',
        source: 'app',
        inspection,
        sourceCommit,
        workingTreeDirty,
      },
      null,
      2,
    ),
  );
} else {
  const directory = resolve(argument);
  const inspection = inspectJudgeSnapshot(directory);
  if (mode === 'inspect') console.log(JSON.stringify(inspection, null, 2));
  else {
    if (!existsSync('dist/index.html')) throw new Error('Run npm run build before judge:start');
    const port = Number(process.env.PORT || 4325);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
    const working = mkdtempSync(join(base, 'ripple-judge-working-'));
    copyTree(join(directory, 'snapshot', 'db'), join(working, 'db'));
    console.log(
      `Open saved case: ${entryUrl(`http://127.0.0.1:${port}/`, inspection.changeId, inspection.selectedItemId).href}`,
    );
    console.log(`Retained working database: ${join(working, 'db')}`);
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', resolve('server/index.ts'), '--production'],
      {
        stdio: 'inherit',
        env: { ...process.env, RIPPLE_DB_PATH: join(working, 'db'), PORT: String(port) },
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
}
