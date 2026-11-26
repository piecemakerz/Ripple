import type { SourceVersion } from './types.js';

// Imported versions are integer sequences. Named sample versions are not ordered.
export function newerSourceVersion(original: SourceVersion, sources: readonly SourceVersion[]) {
  if (!/^\d+$/.test(original.version)) return undefined;
  return sources.reduce<SourceVersion | undefined>((latest, candidate) => {
    if (candidate.documentId !== original.documentId || !/^\d+$/.test(candidate.version))
      return latest;
    return Number(candidate.version) > Number(latest?.version ?? original.version)
      ? candidate
      : latest;
  }, undefined);
}
