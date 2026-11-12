import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillDigest } from './skill-integrity.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = join(root, '.agents/skills');
const manifest = JSON.parse(readFileSync(join(root, '.agents/skills-lock.json'), 'utf8')) as {
  schemaVersion: number;
  snapshots: { name: string; ref: string; sha256: string; files: number }[];
};
assert.equal(manifest.schemaVersion, 1);
for (const snapshot of manifest.snapshots) {
  assert.match(snapshot.name, /^[a-z0-9-]+$/);
  const actual = skillDigest(join(skillsRoot, snapshot.name));
  assert.equal(actual.files, snapshot.files, `Incomplete skill: ${snapshot.name}`);
  assert.equal(actual.sha256, snapshot.sha256, `Unreviewed skill change: ${snapshot.name}`);
}
const skills = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const text = readFileSync(join(skillsRoot, entry.name, 'SKILL.md'), 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatter, `Missing skill frontmatter: ${entry.name}`);
    const name = frontmatter[1].match(/^name:\s*["']?([a-z0-9-]+)["']?\s*$/m)?.[1];
    assert.equal(name, entry.name, `Skill name/folder mismatch: ${entry.name}`);
    assert.match(frontmatter[1], /^description:\s*\S.+$/m);
    return name;
  })
  .sort();
const normalize = (path: string) => readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n');
assert.equal(
  normalize('.agents/skills/relate/SKILL.md'),
  normalize('node_modules/@relate/relate/.agents/skills/relate/SKILL.md'),
  'Installed Relate skill and npm package differ; review both before updating the snapshot.',
);
console.log(
  JSON.stringify(
    { ok: true, scope: 'repository', skills, pinnedSnapshots: manifest.snapshots.length },
    null,
    2,
  ),
);
