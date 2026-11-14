import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { caseNames, type CaseName } from './evaluation/case.js';
import { reviewPacket, summarizeReview } from './evaluation/review.js';
import { createReviewApp } from './evaluation/review-server.js';

const args = process.argv.slice(2);
if (args.length === 2 && args[0] === '--check') {
  const input = JSON.parse(readFileSync(resolve(args[1]), 'utf8')) as { caseName?: string };
  if (!caseNames.includes(input.caseName as CaseName)) throw new Error('Unknown review case.');
  const summary = summarizeReview(input, reviewPacket(input.caseName as CaseName));
  console.log(JSON.stringify(summary, null, 2));
  // A well-formed draft or automated test is not a completed human acceptance.
  process.exitCode = summary.humanAttestedAcceptance ? 0 : 2;
} else if (args.length === 0) {
  const directory = resolve(
    process.env.RIPPLE_REVIEW_PATH ||
      join(
        process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'),
        'Ripple',
        'semantic-reviews',
      ),
  );
  const port = Number(process.env.REVIEW_PORT || 4324);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('REVIEW_PORT must be an integer from 1 to 65535.');
  const server = createReviewApp(directory).listen(port, '127.0.0.1', () => {
    console.log(`Semantic review: http://127.0.0.1:${port}`);
    console.log(`Versioned review artifacts: ${directory}`);
    console.log(
      'No application database is opened. Save before switching cases. Human judgments remain pending.',
    );
  });
  server.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  const stop = () => server.close();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} else {
  throw new Error(
    'Usage: npm run evaluate:review OR node --import tsx scripts/review-evaluation.ts --check <review.json>',
  );
}
