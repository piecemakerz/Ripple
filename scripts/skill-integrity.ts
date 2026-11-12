import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// These skill snapshots contain only text. Normalize line endings for Windows checkouts.
export function skillDigest(directory: string) {
  const files: string[] = [];
  function walk(prefix: string) {
    for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      assert.ok(!entry.isSymbolicLink(), `Skill symlink is not supported: ${path}`);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`Unexpected skill entry: ${path}`);
    }
  }
  walk('');
  const hash = createHash('sha256');
  for (const path of files.sort()) {
    const text = readFileSync(join(directory, path), 'utf8').replaceAll('\r\n', '\n');
    hash.update(path).update('\0').update(text).update('\0');
  }
  return { sha256: hash.digest('hex'), files: files.length };
}
