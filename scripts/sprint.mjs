// Sprint tooling.
//   npm run sprint:new -- <NN> [app]      start a sprint: sprints/sprint-<NN>.md + sprint-<NN>/manual-results.md
//   npm run sprint:report -- <NN> [app]   sign-off report for the PO: reports/<app>/sprint-<NN>-report.html
//
// The report joins, per story of the sprint file: the requirement's QA stage (and whether it changed since),
// its test cases, the latest automated result of each (runs with SPRINT=<NN> when there are any), the manual
// results, open differences waiting for the PO, open questions and the bugs raised, and says whether the
// sprint is ready for sign-off and, if not, why.
import fs from 'node:fs';
import path from 'node:path';
import {
  baselineIndex,
  esc,
  latestResults,
  manualResults,
  mdTables,
  parseCases,
  readRootEnv,
  requirementHash,
  resolveApp,
  savedRuns,
  testCasesSource,
  walk,
} from './lib.mjs';

const [command, number, appHint] = process.argv.slice(2);
if (!['new', 'report'].includes(command) || !/^\d+$/.test(number ?? '')) {
  console.error('Usage: npm run sprint:new -- <NN> [app]   |   npm run sprint:report -- <NN> [app]');
  process.exit(1);
}
const sprint = number.padStart(2, '0');
const { app, appDir } = resolveApp(appHint);
const sprintFile = path.join(appDir, 'sprints', `sprint-${sprint}.md`);
const manualFile = path.join(appDir, 'sprints', `sprint-${sprint}`, 'manual-results.md');

if (command === 'new') startSprint();
else sprintReport();

function startSprint() {
  if (fs.existsSync(sprintFile)) {
    console.error(`${sprintFile} already exists.`);
    process.exit(1);
  }
  const qa = process.env.QA_NAME ?? readRootEnv('QA_NAME') ?? '<names>';
  const fill = (text) => text.replaceAll('<NN>', sprint).replaceAll('<app>', app).replace('<names>', qa);
  fs.mkdirSync(path.dirname(manualFile), { recursive: true });
  fs.writeFileSync(sprintFile, fill(fs.readFileSync('templates/sprint.md', 'utf8')));
  fs.writeFileSync(manualFile, fill(fs.readFileSync('templates/manual-results.md', 'utf8')));
  console.log(`\nSprint ${sprint} started for "${app}":
  ${sprintFile}            fill in dates, goal and the Stories table
  ${manualFile}   record manual test results here

Tag the runs of this sprint: SPRINT=${sprint} and BUILD_VERSION=<build> in the root .env (or on the command line),
then npm run sprint:report -- ${sprint} at the end of the sprint.\n`);
}

function sprintReport() {
  if (!fs.existsSync(sprintFile)) {
    console.error(`No ${sprintFile}. Start the sprint with: npm run sprint:new -- ${sprint}`);
    process.exit(1);
  }
  const tables = mdTables(fs.readFileSync(sprintFile, 'utf8'));
  const table = (re) => tables.find((t) => re.test(t.heading))?.rows ?? [];
  const info = Object.fromEntries(tables[0]?.rows.map((r) => [(r.item ?? '').toLowerCase(), r.value]) ?? []);
  const stories = table(/^Stories/i).filter((r) => r.jira || r.story);
  const differences = table(/^Differences/i).filter((r) => (r.jira || r.difference || r['difference (story → build)']) && !/closed|not a bug|accept/i.test(`${r.decision ?? ''} ${r['proposed outcome'] ?? ''} ${r.outcome ?? ''}`));
  const questions = table(/^Questions/i).filter((r) => /ask again|not answered/i.test(`${r.answer} ${r.outcome}`));
  const bugs = table(/^Bugs/i).filter((r) => r['jira bug']);
  const builds = table(/^Builds/i).filter((r) => r.date || r.version);

  // results: runs tagged with this sprint, else every saved run
  const sameSprint = (run) => run.sprint && run.sprint.padStart(2, '0') === sprint;
  const sprintRuns = savedRuns(app).filter(sameSprint);
  const automated = latestResults(app, sprintRuns.length ? sameSprint : () => true);
  const manual = manualResults(appDir);
  const baselines = baselineIndex(appDir);

  const rows = stories.map((s) => {
    const reqFile = s['requirement file'] ? path.join(appDir, s['requirement file']) : '';
    // the Test-cases file column, or else the test-cases file whose Source row is this requirement
    const linked = walk(path.join(appDir, 'test-cases'), '.testcases.md').find((f) => testCasesSource(f, appDir) === s['requirement file']);
    const tcFile = s['test-cases file'] ? path.join(appDir, s['test-cases file']) : (linked ?? '');
    const key = (s['requirement file'] ?? '').replace(/^requirements\//, '');
    const base = baselines[key];
    const changed = base && reqFile && fs.existsSync(reqFile) && base.hash !== requirementHash(fs.readFileSync(reqFile, 'utf8'));
    const cases = tcFile && fs.existsSync(tcFile) ? parseCases(tcFile).filter((c) => c.automate !== 'retired') : [];
    const results = cases.map((c) => {
      const auto = automated.get(c.id);
      const man = manual.get(c.id);
      // a manual result counts when the case has no automated result
      const result = auto?.result ?? (man ? `manual ${man.result}` : 'not tested');
      return { ...c, result, auto, man };
    });
    const n = (pred) => results.filter(pred).length;
    const counts = {
      cases: results.length,
      passed: n((r) => r.result === 'passed' || r.result === 'flaky' || r.result === 'manual pass'),
      failed: n((r) => r.result === 'failed' || r.result === 'manual fail'),
      knownBug: n((r) => r.result === 'known bug'),
      pending: n((r) => r.result === 'PO pending'),
      blocked: n((r) => r.result === 'manual blocked' || r.result === 'skipped'),
      notTested: n((r) => r.result === 'not tested'),
    };
    const criticalNotTested = results.filter((r) => r.result === 'not tested' && ['critical', 'blocker'].includes(r.priority));
    const reasons = [];
    if (!tcFile || !fs.existsSync(tcFile)) reasons.push('no test-cases file');
    if (changed) reasons.push('requirement changed since the QA baseline (req:diff, /qa-update)');
    if (counts.failed) reasons.push(`${counts.failed} failing`);
    if (counts.pending) reasons.push(`${counts.pending} waiting for a PO decision`);
    if (criticalNotTested.length) reasons.push(`${criticalNotTested.length} critical/blocker not tested`);
    if (counts.blocked) reasons.push(`${counts.blocked} blocked or skipped`);
    return {
      jira: s.jira,
      story: s.story,
      stage: base ? `${base.stage} ${base.date}${base.by ? ` (${base.by})` : ''}` : 'not baselined',
      changed,
      counts,
      results,
      criticalNotTested,
      reasons,
      ready: !reasons.length,
    };
  });

  const total = (k) => rows.reduce((sum, r) => sum + r.counts[k], 0);
  const sprintReasons = [
    ...rows.filter((r) => !r.ready).map((r) => `${r.jira}: ${r.reasons.join(', ')}`),
    ...(differences.length ? [`${differences.length} difference(s) without a PO decision`] : []),
    ...(questions.length ? [`${questions.length} question(s) to the developers still open`] : []),
  ];
  const ready = rows.length > 0 && !sprintReasons.length;
  const out = path.join('reports', app, `sprint-${sprint}-report.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page());

  console.log(`\nSprint ${sprint} · ${app}: ${ready ? 'READY FOR SIGN-OFF' : 'NOT READY'}`);
  console.log(`  ${total('cases')} test cases · ${total('passed')} passed · ${total('failed')} failed · ${total('knownBug')} known bug · ${total('pending')} PO pending · ${total('blocked')} blocked · ${total('notTested')} not tested`);
  for (const r of sprintReasons) console.log(`  - ${r}`);
  console.log(`  Results from ${sprintRuns.length ? `${sprintRuns.length} run(s) tagged SPRINT=${sprint}` : 'all saved runs (none is tagged with this sprint: set SPRINT in the root .env)'} and ${manual.size} manual result(s).`);
  console.log(`  Report: ${out}\n`);

  function page() {
    const cls = (v) => (/fail/.test(v) ? 'bad' : /pass/.test(v) ? 'ok' : /not tested|blocked|skipped/.test(v) ? 'muted' : 'warn');
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    const tested = total('cases') - total('notTested');
    const stat = (label, value, c = '') => `<div class="stat ${c}"><b>${value}</b><span>${label}</span></div>`;
    const list = (title, items, render) => (items.length ? `<h2>${esc(title)} (${items.length})</h2><ul>${items.map(render).join('')}</ul>` : '');
    const caseRows = rows.flatMap((r) =>
      r.results.map(
        (c) => `<tr><td>${esc(r.jira)}</td><td>${esc(c.id)}</td><td>${esc(c.title)}</td><td>${esc(c.priority)}</td><td>${esc(c.automate)}</td>
<td class="${cls(c.result)}">${esc(c.result)}</td><td>${esc(c.auto ? `${c.auto.started.slice(0, 10)}${c.auto.build ? ` · ${c.auto.build}` : ''}` : c.man ? `${c.man.date} · ${c.man.by}` : '')}</td>
<td>${esc(c.auto?.note || c.man?.bug || c.man?.notes || '')}</td></tr>`,
      ),
    );
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sprint ${esc(sprint)} report · ${esc(app)}</title>
<style>
  :root { --ink:#111a3a; --muted:#56608a; --line:#e2e6f6; --head:#eef1fd; --brand:#4361ee; --ok:#15803d; --bad:#be123c; --warn:#a16207; }
  body { font: 14px/1.5 "Segoe UI", system-ui, Arial, sans-serif; color: var(--ink); margin: 0; background: #f4f6fd; }
  header { background: linear-gradient(115deg, #4361ee, #2f47c9); color: #fff; padding: 20px 28px; }
  header h1 { margin: 0; font-size: 22px; } header p { margin: 4px 0 0; opacity: .9; }
  main { padding: 20px 28px; max-width: 1200px; }
  .verdict { border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; background: #fff; border-left: 6px solid; }
  .verdict.ok { border-color: var(--ok); } .verdict.bad { border-color: var(--bad); }
  .verdict b { font-size: 18px; } .verdict ul { margin: 6px 0 0; }
  .stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .stat { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; min-width: 110px; }
  .stat b { display: block; font-size: 22px; } .stat span { color: var(--muted); font-size: 12px; }
  .stat.ok b { color: var(--ok); } .stat.bad b { color: var(--bad); } .stat.warn b { color: var(--warn); }
  h2 { font-size: 15px; color: var(--brand); margin: 22px 0 8px; text-transform: uppercase; letter-spacing: .04em; }
  .wrap { overflow-x: auto; background: #fff; border: 1px solid var(--line); border-radius: 10px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border-bottom: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: var(--head); white-space: nowrap; }
  td:first-child { white-space: nowrap; }
  td.ok { color: var(--ok); font-weight: 600; } td.bad { color: var(--bad); font-weight: 600; } td.warn { color: var(--warn); font-weight: 600; } td.muted { color: var(--muted); }
  ul { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 10px 10px 30px; }
  .sign { margin-top: 28px; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
  @media print { body { background: #fff; } .wrap, ul, .stat, .verdict, .sign { border-color: #ccc; } }
</style></head><body>
<header><h1>Sprint ${esc(sprint)} · QA sign-off report</h1>
<p>${esc(app)}${info.goal ? ` · ${esc(info.goal)}` : ''}${info.dates ? ` · ${esc(info.dates)}` : ''} · generated ${esc(new Date().toLocaleString())}</p></header>
<main>
<div class="verdict ${ready ? 'ok' : 'bad'}"><b>${ready ? 'Ready for sign-off' : 'Not ready for sign-off'}</b>
${sprintReasons.length ? `<ul>${sprintReasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p>Every test case passed or is a ticketed known bug, nothing waits for the PO and no critical case is untested.</p>'}</div>
<div class="stats">
${stat('test cases', total('cases'))}${stat(`tested (${pct(tested, total('cases'))}%)`, tested)}${stat('passed', total('passed'), 'ok')}${stat('failed', total('failed'), total('failed') ? 'bad' : '')}
${stat('known bugs', total('knownBug'), total('knownBug') ? 'warn' : '')}${stat('PO pending', total('pending'), total('pending') ? 'warn' : '')}${stat('blocked / skipped', total('blocked'))}${stat('not tested', total('notTested'), total('notTested') ? 'warn' : '')}
</div>
<p class="muted">Automated results from ${sprintRuns.length ? `${sprintRuns.length} run(s) tagged SPRINT=${esc(sprint)}` : 'the latest saved runs (no run is tagged with this sprint)'}; manual results from sprints/**/manual-results.md.</p>

<h2>Stories</h2>
<div class="wrap"><table><thead><tr><th>Jira</th><th>Story</th><th>Requirement (QA stage)</th><th>Cases</th><th>Passed</th><th>Failed</th><th>Known bug</th><th>PO pending</th><th>Blocked</th><th>Not tested</th><th>Status</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${esc(r.jira)}</td><td>${esc(r.story)}</td><td>${esc(r.stage)}${r.changed ? ' <b class="bad">· CHANGED</b>' : ''}</td><td>${r.counts.cases}</td><td>${r.counts.passed}</td><td>${r.counts.failed}</td><td>${r.counts.knownBug}</td><td>${r.counts.pending}</td><td>${r.counts.blocked}</td><td>${r.counts.notTested}</td><td class="${r.ready ? 'ok' : 'bad'}">${r.ready ? 'Ready' : esc(r.reasons.join('; '))}</td></tr>`).join('\n')}
</tbody></table></div>

${list('Waiting for a PO decision', differences, (d) => `<li><b>${esc(d['#'] || d.jira)}</b> ${esc(d.jira && d['#'] ? `(${d.jira}) ` : '')}${esc(d['difference (story → build)'] || d.difference || '')}${d['proposed outcome'] ? ` <i>→ ${esc(d['proposed outcome'])}</i>` : ''}</li>`)}
${list('Open questions to the developers', questions, (q) => `<li><b>${esc(q.jira)}</b> ${esc(q.question)} <i>(${esc(q.answer)})</i></li>`)}
${list('Bugs raised', bugs, (b) => `<li><b>${esc(b['jira bug'])}</b> ${esc(b.story)} · ${esc(b.severity)} · ${esc(b.status)}</li>`)}
${list('Critical / blocker cases not tested', rows.flatMap((r) => r.criticalNotTested.map((c) => ({ ...c, jira: r.jira }))), (c) => `<li><b>${esc(c.id)}</b> ${esc(c.title)} (${esc(c.automate)})</li>`)}
${builds.length ? `<h2>Builds received</h2><div class="wrap"><table><thead><tr><th>Date</th><th>Version</th><th>Stories / fixes</th><th>Smoke</th></tr></thead><tbody>${builds.map((b) => `<tr><td>${esc(b.date)}</td><td>${esc(b.version)}</td><td>${esc(b['stories / fixes'])}</td><td>${esc(b.smoke)}</td></tr>`).join('')}</tbody></table></div>` : ''}

<h2>Every test case</h2>
<div class="wrap"><table><thead><tr><th>Jira</th><th>ID</th><th>Title</th><th>Priority</th><th>Automate</th><th>Result</th><th>When</th><th>Bug / PO decision / note</th></tr></thead><tbody>
${caseRows.join('\n')}
</tbody></table></div>

<div class="sign"><b>Sign-off</b><p>QA: ____________________ Date: __________ &nbsp;&nbsp; PO: ____________________ Date: __________</p></div>
</main></body></html>`;
  }
}
