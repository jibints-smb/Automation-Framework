// Runs the tests of one story or of a whole sprint, found from the test-cases files (no extra tags needed).
//   npm run test:story -- BK-1 [more keys] [-- playwright options]
//   npm run test:sprint -- 01 [-- playwright options]      every story in sprints/sprint-01.md
// The spec files come from each test-cases file's "Spec file" row; a story = its test-cases file's "Jira" row.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mdTables, resolveApp, testCasesHeader, walk } from './lib.mjs';

const [scope, ...rest] = process.argv.slice(2);
const split = rest.indexOf('--');
const keys = split >= 0 ? rest.slice(0, split) : rest.filter((a) => !a.startsWith('-'));
const playwrightArgs = split >= 0 ? rest.slice(split + 1) : rest.filter((a) => a.startsWith('-'));
if (!['story', 'sprint'].includes(scope) || !keys.length) {
  console.error('Usage: npm run test:story -- <JIRA-KEY> [...]   |   npm run test:sprint -- <NN>');
  process.exit(1);
}
const { app, appDir } = resolveApp();

let stories = keys.map((k) => k.toUpperCase());
if (scope === 'sprint') {
  const file = path.join(appDir, 'sprints', `sprint-${keys[0].padStart(2, '0')}.md`);
  if (!fs.existsSync(file)) {
    console.error(`No ${file}`);
    process.exit(1);
  }
  const table = mdTables(fs.readFileSync(file, 'utf8')).find((t) => /^Stories/i.test(t.heading));
  stories = (table?.rows ?? []).map((r) => r.jira?.trim().toUpperCase()).filter(Boolean);
}

const specs = new Set();
for (const file of walk(path.join(appDir, 'test-cases'), '.testcases.md')) {
  const header = testCasesHeader(file);
  if (!stories.includes((header.jira ?? '').toUpperCase())) continue;
  if (!header.spec) {
    console.warn(`! ${file} has no "Spec file" row: its tests can't be selected`);
    continue;
  }
  specs.add(path.join(appDir, header.spec).replace(/\\/g, '/'));
}
if (!specs.size) {
  console.error(`No tests found for ${stories.join(', ')} in ${app} (test-cases files with a matching "Jira" row and a "Spec file").`);
  process.exit(1);
}
console.log(`\nRunning ${scope === 'sprint' ? `sprint ${keys[0]}` : 'story'} ${stories.join(', ')}: ${[...specs].join(', ')}\n`);
const run = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...specs, ...playwrightArgs], {
  stdio: 'inherit',
  env: { ...process.env, APP: app, ...(scope === 'sprint' && !process.env.SPRINT ? { SPRINT: keys[0].padStart(2, '0') } : {}) },
});
process.exit(run.status ?? 1);
