// Test-case coverage: compares the IDs in apps/<app>/test-cases/**/*.testcases.md with the automated tests,
// and counts the manual results (sprints/**/manual-results.md) so cases that can't be automated are covered too.
// Usage: npm run coverage:tc [-- <app>] [--strict]
//   --strict  exit with code 1 when a case marked "Automate: yes" has no test, or a retired case still has one (CI)
import { appCode, isAutomated, manualResults, parseCases, rel, resolveApp, walk } from './lib.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const { app, appDir } = resolveApp(args.find((a) => !a.startsWith('--')));

const code = appCode(appDir);
const manual = manualResults(appDir);
const rows = walk(`${appDir}/test-cases`, '.testcases.md')
  .flatMap(parseCases)
  .map((c) => {
    const automated = isAutomated(c.id, code);
    const status =
      c.automate === 'retired' ? (automated ? 'RETIRED!' : 'retired')
      : automated ? 'automated'
      : c.automate === 'yes' ? 'MISSING'
      : c.automate === 'no' ? 'manual'
      : 'planned';
    const man = manual.get(c.id);
    return { ...c, status, manual: man ? `${man.result} ${man.date}` : '', file: rel(appDir, c.file) };
  });

const width = Math.max(4, ...rows.map((r) => r.id.length));
console.log(`\nTest-case coverage for "${app}"\n`);
console.log(`${'ID'.padEnd(width)}  ${'Status'.padEnd(9)}  Automate  ${'Manual result'.padEnd(16)}  Title`);
console.log(`${'-'.repeat(width)}  ---------  --------  ${'-'.repeat(16)}  ${'-'.repeat(40)}`);
for (const r of rows) {
  console.log(`${r.id.padEnd(width)}  ${r.status.padEnd(9)}  ${r.automate.padEnd(8)}  ${r.manual.padEnd(16)}  ${r.title}  (${r.file})`);
}

const count = (s) => rows.filter((r) => r.status === s).length;
const active = rows.filter((r) => r.automate !== 'retired');
const automatable = active.filter((r) => r.automate === 'yes').length;
const pct = automatable ? Math.round((count('automated') / automatable) * 100) : 100;
// covered = automated, or tested by hand (manual result recorded)
const covered = active.filter((r) => r.status === 'automated' || r.manual).length;
console.log(
  `\n${active.length} test cases (${count('retired')} retired not counted): ${count('automated')} automated, ${count('MISSING')} missing, ` +
    `${count('planned')} planned later, ${count('manual')} manual-only. Automation coverage: ${pct}%`,
);
console.log(`Covered (automated or with a manual result): ${covered} of ${active.length} (${Math.round((covered / Math.max(active.length, 1)) * 100)}%)`);
const uncovered = active.filter((r) => r.status !== 'automated' && !r.manual && ['critical', 'blocker'].includes(r.priority));
if (uncovered.length) {
  console.log(`\n! ${uncovered.length} critical/blocker case(s) not automated and not tested by hand: ${uncovered.map((r) => r.id).join(', ')}`);
  console.log(`  Record manual results in ${appDir}/sprints/sprint-<NN>/manual-results.md, or automate them.`);
}
if (count('RETIRED!')) console.log(`\n✗ Retired but still automated (delete the test): ${rows.filter((r) => r.status === 'RETIRED!').map((r) => r.id).join(', ')}`);
console.log('');
if (strict && (count('MISSING') > 0 || count('RETIRED!') > 0)) process.exit(1);
