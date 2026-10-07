// Test-case coverage: compares the IDs in apps/<app>/test-cases/**/*.testcases.md with the automated tests.
// Usage: npm run coverage:tc [-- <app>] [--strict]
//   --strict  exit with code 1 when a case marked "Automate: yes" has no test (for CI)
import { appCode, isAutomated, parseCases, rel, resolveApp, walk } from './lib.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const { app, appDir } = resolveApp(args.find((a) => !a.startsWith('--')));

const code = appCode(appDir);
const rows = walk(`${appDir}/test-cases`, '.testcases.md')
  .flatMap(parseCases)
  .map((c) => {
    const automated = isAutomated(c.id, code);
    const status = automated ? 'automated' : c.automate === 'yes' ? 'MISSING' : c.automate === 'no' ? 'manual' : 'planned';
    return { ...c, status, file: rel(appDir, c.file) };
  });

const width = Math.max(4, ...rows.map((r) => r.id.length));
console.log(`\nTest-case coverage for "${app}"\n`);
console.log(`${'ID'.padEnd(width)}  ${'Status'.padEnd(9)}  Automate  Title`);
console.log(`${'-'.repeat(width)}  ---------  --------  ${'-'.repeat(40)}`);
for (const r of rows) console.log(`${r.id.padEnd(width)}  ${r.status.padEnd(9)}  ${r.automate.padEnd(8)}  ${r.title}  (${r.file})`);

const count = (s) => rows.filter((r) => r.status === s).length;
const automatable = rows.filter((r) => r.automate === 'yes').length;
const pct = automatable ? Math.round((count('automated') / automatable) * 100) : 100;
console.log(
  `\n${rows.length} test cases: ${count('automated')} automated, ${count('MISSING')} missing, ` +
    `${count('planned')} planned later, ${count('manual')} manual-only. Automation coverage: ${pct}%\n`,
);
if (strict && count('MISSING') > 0) process.exit(1);
