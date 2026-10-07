/**
 * Keeps the report of every test run, so results can be looked up days or weeks later.
 *
 *   reports/<app>/2026-10-05_14-30-12_qa_FAILED/
 *     report.html      the Allure report of that run: one file, opens with a double-click
 *     summary.json     when, which app/environment/projects, counts, the command that was run
 *   reports/index.html every saved run, newest first (npm run reports)
 *   reports/flaky.html tests that passed only on a retry, or both passed and failed, in recent runs
 *
 * Runs as the last reporter in playwright.config.ts, after allure-playwright has written its results.
 * Settings (root .env): REPORT_ARCHIVE=off to stop saving, REPORT_KEEP_DAYS=<n> to delete old runs.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import { app, settings } from '@core/config/app';
import { ROOT_DIR, env } from '@core/config/env';

const RESULTS_DIR = path.join(ROOT_DIR, 'allure-results');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const ALLURE_CLI = path.join(ROOT_DIR, 'node_modules', 'allure', 'cli.js');
const DAY_MS = 24 * 60 * 60 * 1000;
/** How many recent runs per app the flaky-test page looks at. */
const FLAKY_WINDOW = 30;

/** One test's result in a run. outcome: expected (passed) · flaky (passed on retry) · unexpected (failed) · skipped */
interface TestOutcome {
  project: string;
  file: string;
  title: string;
  outcome: string;
}

interface RunSummary {
  app: string;
  appName: string;
  environment: string;
  baseUrl: string;
  started: string;
  durationSec: number;
  status: string;
  projects: string[];
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  command: string;
  /** Path of the report relative to the run folder; empty when the report couldn't be built. */
  report: string;
  /** Every test's outcome, for the flaky-test page (missing in runs saved before it existed). */
  tests?: TestOutcome[];
}

export default class ReportArchive implements Reporter {
  private suite?: Suite;
  private started = new Date();

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite;
    this.started = new Date();
  }

  printsToStdio(): boolean {
    return false;
  }

  async onEnd(result: FullResult): Promise<void> {
    // --list only prints the tests: nothing ran, so there is no run to keep
    if (!env.reportArchive.enabled || !this.suite || process.argv.includes('--list')) return;
    // the login setup alone (npm run auth) is not a test run worth keeping
    const tests = this.suite.allTests().filter((t) => projectOf(t) !== 'setup');
    if (!tests.length) return;

    const outcomes = tests.map((t) => t.outcome());
    const count = (o: string) => outcomes.filter((x) => x === o).length;
    const status = result.status.toUpperCase();
    const folder = `${stamp(this.started)}_${env.name}_${status}`;
    const dir = path.join(REPORTS_DIR, env.app, folder);
    fs.mkdirSync(dir, { recursive: true });

    const title = `${app.name} · ${env.name.toUpperCase()} · ${this.started.toLocaleString()} · ${status}`;
    const report = buildReport(dir, title);

    const summary: RunSummary = {
      app: env.app,
      appName: app.name,
      environment: env.name,
      baseUrl: settings.baseUrl,
      started: this.started.toISOString(),
      durationSec: Math.round(result.duration / 1000),
      status: result.status,
      projects: [...new Set(tests.map(projectOf))],
      total: tests.length,
      passed: count('expected'),
      failed: count('unexpected'),
      flaky: count('flaky'),
      skipped: count('skipped'),
      command: process.argv.slice(2).join(' '),
      report,
      tests: tests.map((t) => ({
        project: projectOf(t),
        file: path.relative(ROOT_DIR, t.location.file).split(path.sep).join('/'),
        title: t.titlePath().slice(3).join(' › '),
        outcome: t.outcome(),
      })),
    };
    fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));

    removeOldRuns(env.reportArchive.keepDays);
    writeIndex();
    writeFlakyPage();
    const flaky = summary.tests!.filter((t) => t.outcome === 'flaky');
    if (flaky.length) {
      console.log(`\n${flaky.length} flaky test(s), passed only on a retry:\n${flaky.map((t) => `  [${t.project}] ${t.title}`).join('\n')}`);
    }
    console.log(`\nReport saved: ${path.relative(ROOT_DIR, path.join(dir, report || ''))}   (all runs: npm run reports)`);
  }
}

/** Single-file Allure report of this run; falls back to keeping the raw results if Allure fails. */
function buildReport(dir: string, title: string): string {
  const tmp = path.join(dir, '.allure');
  const run = spawnSync(process.execPath, [ALLURE_CLI, 'generate', RESULTS_DIR, '--output', tmp], {
    cwd: ROOT_DIR,
    env: { ...process.env, ALLURE_ARCHIVE_TITLE: title },
    encoding: 'utf8',
  });
  const html = path.join(tmp, 'index.html');
  if (run.status === 0 && fs.existsSync(html)) {
    fs.renameSync(html, path.join(dir, 'report.html'));
    fs.rmSync(tmp, { recursive: true, force: true });
    return 'report.html';
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.cpSync(RESULTS_DIR, path.join(dir, 'allure-results'), { recursive: true });
  console.warn(`Report archive: Allure could not build the report, raw results kept instead.\n${run.stderr || run.error || ''}`);
  return '';
}

function removeOldRuns(keepDays: number): void {
  if (!keepDays) return;
  const limit = Date.now() - keepDays * DAY_MS;
  for (const run of readRuns()) {
    if (Date.parse(run.summary.started) < limit) fs.rmSync(run.dir, { recursive: true, force: true });
  }
}

function readRuns(): { dir: string; summary: RunSummary }[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  const runs: { dir: string; summary: RunSummary }[] = [];
  for (const appDir of fs.readdirSync(REPORTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const base = path.join(REPORTS_DIR, appDir.name);
    for (const runDir of fs.readdirSync(base)) {
      const file = path.join(base, runDir, 'summary.json');
      if (!fs.existsSync(file)) continue;
      try {
        runs.push({ dir: path.join(base, runDir), summary: JSON.parse(fs.readFileSync(file, 'utf8')) });
      } catch {
        // a damaged summary only hides that run from the list
      }
    }
  }
  return runs.sort((a, b) => b.summary.started.localeCompare(a.summary.started));
}

/** reports/index.html: every saved run, newest first, with a filter box. */
function writeIndex(): void {
  const rows = readRuns()
    .map(({ dir, summary: s }) => {
      const rel = path.relative(REPORTS_DIR, dir).split(path.sep).join('/');
      const link = s.report ? `<a href="${esc(rel)}/${esc(s.report)}">Open report</a>` : `<span class="muted">raw results only</span>`;
      const ok = s.status === 'passed';
      return `<tr>
  <td>${esc(new Date(s.started).toLocaleString())}</td>
  <td>${esc(s.appName)}</td>
  <td>${esc(s.environment.toUpperCase())}</td>
  <td><span class="pill ${ok ? 'ok' : 'bad'}">${esc(s.status)}</span></td>
  <td class="n">${s.passed}</td><td class="n${s.failed ? ' red' : ''}">${s.failed}</td><td class="n">${s.flaky}</td><td class="n">${s.skipped}</td>
  <td class="n">${formatDuration(s.durationSec)}</td>
  <td>${esc(s.projects.join(', '))}</td>
  <td><code>${esc(s.command || '(all tests)')}</code></td>
  <td>${link}</td>
</tr>`;
    })
    .join('\n');

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORTS_DIR, 'index.html'),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test Run History</title>
<style>
  :root { --ink:#1c2430; --muted:#5b6676; --line:#d9dee6; --bg:#fff; --head:#e8f0f8; --brand:#1f4e79; --ok:#0f7b6c; --bad:#a12828; }
  @media (prefers-color-scheme: dark) { :root { --ink:#e3e8ef; --muted:#9aa5b4; --line:#334155; --bg:#111827; --head:#1e2a3b; --brand:#8ab4e0; --ok:#4cc3a8; --bad:#f08080; } }
  body { font-family: "Segoe UI", Arial, sans-serif; color: var(--ink); background: var(--bg); margin: 0; padding: 24px 16px; }
  h1 { color: var(--brand); font-size: 22px; margin: 0 0 4px; }
  p { color: var(--muted); margin: 0 0 16px; }
  input { padding: 6px 10px; border: 1px solid var(--line); border-radius: 4px; width: 320px; max-width: 100%; background: var(--bg); color: var(--ink); margin-bottom: 12px; }
  .wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; white-space: nowrap; }
  th { background: var(--head); position: sticky; top: 0; }
  td.n { text-align: right; } td.red { color: var(--bad); font-weight: 600; }
  code { font-size: 12px; color: var(--muted); }
  a { color: var(--brand); font-weight: 600; }
  .pill { padding: 1px 8px; border-radius: 10px; color: #fff; font-size: 12px; }
  .pill.ok { background: var(--ok); } .pill.bad { background: var(--bad); }
  .muted { color: var(--muted); }
</style></head>
<body>
<h1>Test run history</h1>
<p>Every test run, newest first. Each report is a single file and opens offline. Updated after every run. · <a href="flaky.html">Flaky tests</a></p>
<input id="q" placeholder="Filter: app, environment, status, date, command..." oninput="filter()">
<div class="wrap"><table>
<thead><tr><th>Started</th><th>App</th><th>Env</th><th>Status</th><th>Passed</th><th>Failed</th><th>Flaky</th><th>Skipped</th><th>Duration</th><th>Projects</th><th>Command</th><th>Report</th></tr></thead>
<tbody id="runs">
${rows || '<tr><td colspan="12" class="muted">No runs saved yet.</td></tr>'}
</tbody></table></div>
<script>
function filter() {
  const q = document.getElementById('q').value.toLowerCase();
  for (const row of document.querySelectorAll('#runs tr')) row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
}
</script>
</body></html>
`,
  );
}

/** reports/flaky.html: tests that were unstable in the last FLAKY_WINDOW runs of each app. */
function writeFlakyPage(): void {
  type Row = { app: string; project: string; file: string; title: string; runs: number; passed: number; retried: number; failed: number; last?: { started: string; link: string } };
  const rows = new Map<string, Row>();
  const perApp = new Map<string, number>();

  for (const { dir, summary: s } of readRuns()) {
    if (!s.tests) continue;
    const seen = (perApp.get(s.app) ?? 0) + 1;
    perApp.set(s.app, seen);
    if (seen > FLAKY_WINDOW) continue;
    const link = s.report ? `${path.relative(REPORTS_DIR, dir).split(path.sep).join('/')}/${s.report}` : '';
    for (const t of s.tests) {
      if (t.outcome === 'skipped') continue;
      const key = [s.app, t.project, t.file, t.title].join('|');
      const row = rows.get(key) ?? { app: s.appName, project: t.project, file: t.file, title: t.title, runs: 0, passed: 0, retried: 0, failed: 0 };
      row.runs++;
      if (t.outcome === 'expected') row.passed++;
      else if (t.outcome === 'flaky') row.retried++;
      else row.failed++;
      // runs are newest first: the first unstable one is the latest
      if (!row.last && t.outcome !== 'expected') row.last = { started: s.started, link };
      rows.set(key, row);
    }
  }

  const unstable = [...rows.values()]
    .filter((r) => r.retried > 0 || (r.failed > 0 && r.passed > 0))
    .sort((a, b) => (b.retried + b.failed) / b.runs - (a.retried + a.failed) / a.runs);
  const body = unstable
    .map((r) => {
      const share = Math.round(((r.retried + r.failed) / r.runs) * 100);
      const last = r.last ? (r.last.link ? `<a href="${esc(r.last.link)}">${esc(new Date(r.last.started).toLocaleString())}</a>` : esc(new Date(r.last.started).toLocaleString())) : '';
      return `<tr><td>${esc(r.title)}<br><code>${esc(r.file)}</code></td><td>${esc(r.app)}</td><td>${esc(r.project)}</td>
  <td class="n">${share}%</td><td class="n">${r.runs}</td><td class="n">${r.passed}</td><td class="n">${r.retried}</td><td class="n${r.failed ? ' red' : ''}">${r.failed}</td><td>${last}</td></tr>`;
    })
    .join('\n');

  const index = fs.readFileSync(path.join(REPORTS_DIR, 'index.html'), 'utf8');
  const style = index.slice(index.indexOf('<style>'), index.indexOf('</style>') + '</style>'.length);
  fs.writeFileSync(
    path.join(REPORTS_DIR, 'flaky.html'),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flaky Tests</title>
${style}</head>
<body>
<h1>Flaky tests</h1>
<p>Tests that passed only on a retry, or both passed and failed, in the last ${FLAKY_WINDOW} saved runs of each app. Most unstable first.
A flaky test hides real bugs and wastes re-runs: fix the wait or the test data (/qa-fix), don't add retries. · <a href="index.html">All runs</a></p>
<p>Check one test locally: <code>npm run flaky:check -- &lt;spec&gt; -g "&lt;test ID&gt;"</code> (runs it 10 times without retries).</p>
<div class="wrap"><table>
<thead><tr><th>Test</th><th>App</th><th>Project</th><th>Unstable</th><th>Runs</th><th>Passed</th><th>Passed on retry</th><th>Failed</th><th>Last unstable run</th></tr></thead>
<tbody>
${body || '<tr><td colspan="9" class="muted">No flaky tests in the saved runs.</td></tr>'}
</tbody></table></div>
</body></html>
`,
  );
}

function projectOf(test: TestCase): string {
  return test.parent.project()?.name ?? '';
}

/** Local date and time, safe for folder names: 2026-10-05_14-30-12 */
function stamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

function formatDuration(sec: number): string {
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
