import { caseNames, type CaseName } from './case.js';

export function parseEvaluationArgs(args: string[]) {
  let demo = false;
  let caseName: CaseName | undefined;
  const usage =
    'Usage: node --import tsx scripts/evaluate.ts [--case async-owner|semver-deprecation] [--demo]';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--demo' && !demo) demo = true;
    else if (args[i] === '--case' && !caseName && caseNames.includes(args[i + 1] as CaseName))
      caseName = args[++i] as CaseName;
    else throw new Error(usage);
  }
  return { demo, caseName: caseName ?? (demo ? 'async-owner' : undefined) };
}
