// Framework rules check (no dependencies): the conventions in CLAUDE.md that a type check can't see.
// Usage: npm run lint   (also run by the pre-commit hook and in CI)
//   no test.only / describe.only        a focused test silently skips every other test
//   no waitForTimeout / page.pause()    sleeps make tests slow and flaky; use web-first assertions
//   apps/**: test / expect from '@apps/<app>/fixtures', never from '@playwright/test'
// A line can opt out with a trailing comment: // lint-ignore <reason>
import fs from 'node:fs';
import { rel, walk } from './lib.mjs';

const RULES = [
  { pattern: /\b(test|describe|it)(\.describe)?\.only\s*\(/, message: 'focused test (.only) skips every other test' },
  { pattern: /\.waitForTimeout\s*\(/, message: 'no sleeps: use verify.* (web-first assertions) or auto-waiting actions' },
  { pattern: /\.pause\s*\(\s*\)/, message: 'page.pause() stops the run: remove it before committing' },
  {
    pattern: /import\s*\{[^}]*\b(test|expect)\b[^}]*\}\s*from\s*['"]@playwright\/test['"]/,
    message: "import test / expect from '@apps/<app>/fixtures', not from @playwright/test",
    only: /^apps\//,
    skipTypeImports: true,
  },
];

const files = [...walk('apps', '.ts'), ...walk('src', '.ts')].map((f) => rel('.', f));
const problems = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/\/\/\s*lint-ignore\b/.test(line) || /^\s*(\*|\/\/)/.test(line)) return; // comments and opt-outs
    for (const rule of RULES) {
      if (rule.only && !rule.only.test(file)) continue;
      if (rule.skipTypeImports && /^\s*import\s+type\b/.test(line)) continue;
      if (rule.pattern.test(line)) problems.push(`${file}:${i + 1}  ${rule.message}`);
    }
  });
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`lint: ${files.length} files checked, no problems.`);
