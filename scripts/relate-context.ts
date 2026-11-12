// Development preflight only: never opens the application's persistent database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '@relate/relate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const packagePath = require.resolve('@relate/relate/package.json');
const installed = JSON.parse(readFileSync(packagePath, 'utf8')) as { version: string };
const project = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies: { '@relate/relate': string };
};
assert.equal(
  installed.version,
  project.dependencies['@relate/relate'],
  'Run npm ci: version mismatch',
);
const skillPath = join(dirname(packagePath), '.agents/skills/relate/SKILL.md');
const typesPath = join(dirname(packagePath), 'index.d.ts');
const skill = readFileSync(skillPath, 'utf8');
assert.match(skill, /name: relate\r?\n/);
assert.match(skill, /Node\.js/);
assert.ok(readFileSync(typesPath, 'utf8').length > 0, 'Installed Relate types are missing');

const db = Database.open(':memory:');
const result = db.connect().query('RETURN $value AS ok', { value: 1 });
assert.equal(result.single().ok, 1, 'Native parameterized query failed');
assert.equal(result.queryType, 'r', 'Preflight must be a read query');

const projectPath = (path: string) => relative(root, path).replaceAll('\\', '/');
console.log(
  JSON.stringify(
    {
      package: '@relate/relate',
      packageVersion: installed.version,
      nativeParameterizedQuery: 'passed',
      probeStore: ':memory:',
      persistentDatabaseOpened: false,
      readBeforeDevelopment: [
        projectPath(skillPath),
        projectPath(typesPath),
        'docs/RELATE_RESOURCES.md',
      ],
      referenceTag: `https://github.com/relatedb/relate/tree/v${installed.version}`,
      note: 'Node package preflight; not the optional Relate CLI agent-context command. No model call.',
    },
    null,
    2,
  ),
);
