// Traceability check and matrix: requirement → test case → automated test → latest result → bug / PO decision.
// Usage: npm run trace:check [-- <app>] [--strict]
//   Checks the test-case files against the real Playwright test list (data-driven tests included):
//     errors    duplicate test-case IDs · tests without "<ID> | <Title>" · test IDs missing from the test-case files ·
//               tests without their @<ID> tag · retired cases still automated · "Automate: yes" cases without a test
//     warnings  cases marked later/no that have a test · titles that differ · critical/blocker cases with no result
//   Writes reports/<app>/traceability.html and .csv. --strict: exit code 1 when there are errors (for CI).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { esc, latestResults, manualResults, parseCases, rel, resolveApp, testCasesHeader, walk } from './lib.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const { app, appDir } = resolveApp(args.find((a) => !a.startsWith('--')));

// ── the real test list, as Playwright sees it ──
const list = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--list', '--reporter=json', '--grep', '@demo|.*'] /* every test, @demo practice tests included */, {
  env: { ...process.env, APP: app },
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
let listing;
try {
  listing = JSON.parse(list.stdout);
} catch {
  console.error(`Could not list the tests of "${app}":\n${list.stderr || list.stdout}`);
  process.exit(1);
}
const tests = [];
const collect = (suite) => {
  for (const spec of suite.specs ?? []) {
    const projects = [...new Set((spec.tests ?? []).map((t) => t.projectName))].filter((p) => p !== 'setup');
    if (projects.length) tests.push({ title: spec.title, tags: spec.tags ?? [], file: spec.file, line: spec.line, projects });
  }
  (suite.suites ?? []).forEach(collect);
};
(listing.suites ?? []).forEach(collect);

// ── test cases ──
const caseFiles = walk(`${appDir}/test-cases`, '.testcases.md');
const cases = caseFiles.flatMap((file) => {
  const header = testCasesHeader(file);
  return parseCases(file).map((c) => ({ ...c, header, file: rel(appDir, file) }));
});
const byId = new Map();
const errors = [];
const warnings = [];
for (const c of cases) {
  if (byId.has(c.id)) errors.push(`Duplicate test-case ID ${c.id} in ${byId.get(c.id).file} and ${c.file}`);
  else byId.set(c.id, c);
}

const testsById = new Map();
for (const t of tests) {
  const m = t.title.match(/^(TC-[A-Z0-9-]+)\s*\|\s*(.+)$/i);
  const where = `${t.file}:${t.line}`;
  if (!m) {
    errors.push(`Test "${t.title}" (${where}) is not titled "<ID> | <Title>": the report can't find its test case`);
    continue;
  }
  const [, id, title] = m;
  // Playwright lists tags without the @
  if (!t.tags.includes(id) && !t.tags.includes(`@${id}`)) errors.push(`${id} (${where}) has no @${id} tag`);
  const tc = byId.get(id);
  if (!tc) errors.push(`${id} (${where}) is not in any test-cases file of ${app}`);
  else if (norm(tc.title) !== norm(title)) warnings.push(`${id}: test title "${title}" differs from the test case "${tc.title}"`);
  (testsById.get(id) ?? testsById.set(id, []).get(id)).push(t);
}

const automated = latestResults(app);
const manual = manualResults(appDir);
for (const c of byId.values()) {
  const hasTest = testsById.has(c.id);
  if (c.automate === 'retired' && hasTest) errors.push(`${c.id} is retired (Automate: retired) but still has a test: delete the test`);
  if (c.automate === 'yes' && !hasTest) errors.push(`${c.id} is "Automate: yes" but has no test: /qa-automate ${appDir}/${c.file}`);
  if ((c.automate === 'later' || c.automate === 'no') && hasTest) warnings.push(`${c.id} is marked "Automate: ${c.automate}" but has a test: set it to yes`);
  if (['critical', 'blocker'].includes(c.priority) && c.automate !== 'retired' && !hasTest && !manual.has(c.id)) {
    warnings.push(`${c.id} is ${c.priority} and has no automated test and no manual result (${c.automate}): "${c.title}"`);
  }
}

// ── matrix ──
const rows = [...byId.values()].map((c) => {
  const spec = (testsById.get(c.id) ?? []).map((t) => `${rel(appDir, path.join('apps', app, t.file.replace(/^.*?apps[\\/][^\\/]+[\\/]/, '')))}:${t.line}`).join(', ');
  const auto = automated.get(c.id);
  const man = manual.get(c.id);
  return {
    requirement: c.header.source ?? '',
    jira: c.header.jira ?? '',
    id: c.id,
    title: c.title,
    priority: c.priority,
    automate: c.automate,
    spec,
    automated: auto ? `${auto.result} (${auto.started.slice(0, 10)}${auto.build ? `, ${auto.build}` : ''})` : testsById.has(c.id) ? 'not run yet' : '',
    manual: man ? `${man.result} (${man.date}${man.build ? `, ${man.build}` : ''}${man.by ? `, ${man.by}` : ''})` : '',
    note: [auto?.note, man?.bug].filter(Boolean).join(' · '),
  };
});
const outDir = path.join('reports', app);
fs.mkdirSync(outDir, { recursive: true });
const columns = [
  ['Requirement', 'requirement'],
  ['Jira', 'jira'],
  ['Test case', 'id'],
  ['Title', 'title'],
  ['Priority', 'priority'],
  ['Automate', 'automate'],
  ['Test (spec:line)', 'spec'],
  ['Latest automated result', 'automated'],
  ['Manual result', 'manual'],
  ['Bug / PO decision', 'note'],
];
const csv = [columns.map(([h]) => h), ...rows.map((r) => columns.map(([, k]) => r[k]))]
  .map((line) => line.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  .join('\r\n');
fs.writeFileSync(path.join(outDir, 'traceability.csv'), '﻿' + csv); // BOM: Excel opens it as UTF-8
fs.writeFileSync(path.join(outDir, 'traceability.html'), page());

// ── console ──
console.log(`\nTraceability for "${app}": ${byId.size} test cases, ${tests.length} tests\n`);
for (const e of errors) console.log(`✗ ${e}`);
for (const w of warnings) console.log(`! ${w}`);
if (!errors.length && !warnings.length) console.log('Everything is consistent.');
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s). Matrix: ${outDir}/traceability.html (and .csv for Excel)\n`);
if (strict && errors.length) process.exit(1);

function norm(s) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function page() {
  const cls = (v) => (/^failed|^fail/.test(v) ? 'bad' : /^passed|^pass/.test(v) ? 'ok' : /known bug|PO pending|blocked/.test(v) ? 'warn' : '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Traceability · ${esc(app)}</title>
<style>
  :root { --ink:#111a3a; --muted:#56608a; --line:#e2e6f6; --head:#eef1fd; --brand:#4361ee; --ok:#15803d; --bad:#be123c; --warn:#a16207; }
  body { font: 13px/1.45 "Segoe UI", system-ui, Arial, sans-serif; color: var(--ink); margin: 0; padding: 24px 16px; background: #fff; }
  h1 { color: var(--brand); font-size: 20px; margin: 0 0 4px; } p { color: var(--muted); margin: 0 0 12px; }
  .msg { margin: 0 0 4px; } .msg.e { color: var(--bad); } .msg.w { color: var(--warn); }
  input { padding: 6px 10px; border: 1px solid var(--line); border-radius: 4px; width: 320px; max-width: 100%; margin: 12px 0; }
  .wrap { overflow-x: auto; } table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid var(--line); padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: var(--head); position: sticky; top: 0; white-space: nowrap; }
  td.ok { color: var(--ok); font-weight: 600; } td.bad { color: var(--bad); font-weight: 600; } td.warn { color: var(--warn); font-weight: 600; }
  code { font-size: 12px; color: var(--muted); }
</style></head><body>
<h1>Traceability · ${esc(app)}</h1>
<p>Requirement → test case → automated test → latest result → bug / PO decision. Generated ${esc(new Date().toLocaleString())} by npm run trace:check.</p>
${errors.map((e) => `<div class="msg e">✗ ${esc(e)}</div>`).join('')}${warnings.map((w) => `<div class="msg w">! ${esc(w)}</div>`).join('')}
<input id="q" placeholder="Filter: ID, title, result, Jira..." oninput="for (const r of document.querySelectorAll('tbody tr')) r.style.display = r.textContent.toLowerCase().includes(this.value.toLowerCase()) ? '' : 'none'">
<div class="wrap"><table><thead><tr>${columns.map(([h]) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
${rows.map((r) => `<tr>${columns.map(([, k]) => `<td class="${k === 'automated' || k === 'manual' ? cls(r[k]) : ''}">${k === 'spec' ? `<code>${esc(r[k])}</code>` : esc(r[k])}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></div></body></html>`;
}
