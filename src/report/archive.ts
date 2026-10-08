/**
 * Keeps the report of every test run, so results can be looked up days or weeks later.
 *
 *   reports/<app>/2026-10-05_14-30-12_qa_FAILED/
 *     report.html      the Allure report of that run: one file, opens with a double-click (share this one)
 *     evidence/        videos and Playwright traces of failed tests, by test case ID (too big for report.html)
 *     summary.json    when, which app/environment/projects, counts, the command that was run
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
import { activeRun, releaseRunLock } from '@core/config/global-setup';
import { redact } from '@core/utils/redact';
import { EVIDENCE_DIR, evidenceName } from './evidence';
import { redactResultsDir } from './redact.cjs';

const RESULTS_DIR = path.join(ROOT_DIR, 'allure-results');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const ALLURE_CLI = path.join(ROOT_DIR, 'node_modules', 'allure', 'cli.js');
const BRAND_SCRIPT = path.join(ROOT_DIR, 'scripts', 'brand-report.mjs');
const DAY_MS = 24 * 60 * 60 * 1000;
/** Building one report can't take longer than this (a hung Allure must not hang the test run). */
const ALLURE_TIMEOUT_MS = 10 * 60 * 1000;
/** How many recent runs per app the flaky-test page looks at. */
const FLAKY_WINDOW = 30;

/** One test's result in a run. outcome: expected (passed) · flaky (passed on retry) · unexpected (failed) · skipped */
interface TestOutcome {
  project: string;
  file: string;
  title: string;
  outcome: string;
  /** knownBug / pendingDecision text, e.g. "Waiting for PO decision D7: ..." (sprint report, traceability). */
  note?: string;
}

/** Compared with the previous saved run of the same app and environment (tests present in both). */
interface RunDiff {
  previous: string;
  newFailures: string[];
  fixed: string[];
  stillFailing: number;
}

interface RunSummary {
  app: string;
  appName: string;
  environment: string;
  /** The QA who ran it (QA_NAME); missing in runs saved before it existed. */
  testedBy?: string;
  /** BUILD_VERSION / RELEASE / SPRINT settings and the test code's git commit, when set. */
  build?: string;
  release?: string;
  sprint?: string;
  commit?: string;
  /** All tests of the suite ran (no --grep / file filter): used for trends and history. */
  fullRun?: boolean;
  diff?: RunDiff;
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
  /** Path of the report relative to the run folder; empty while it is built or when it couldn't be. */
  report: string;
  /** False when the company branding couldn't be applied (report still usable). */
  branded?: boolean;
  /** Expected failures (knownBug / pendingDecision), not counted as passed; missing in older runs. */
  knownBugs?: number;
  pendingDecisions?: number;
  /** The login setup failed, so the other tests did not run. */
  setupFailed?: boolean;
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
    try {
      const summary = this.archive(result);
      if (summary && env.notify.webhook) await notify(summary);
    } catch (error) {
      console.warn(`Report archive: the run could not be saved: ${error}`);
    } finally {
      releaseRunLock();
    }
  }

  private archive(result: FullResult): RunSummary | undefined {
    // --list only prints the tests: nothing ran, so there is no run to keep;
    // --repeat-each (npm run flaky:check) runs one test many times: not a run worth keeping either
    if (!env.reportArchive.enabled || !this.suite || process.argv.some((a) => a === '--list' || a.startsWith('--repeat-each'))) return;
    // this run was stopped because another run holds the lock: the results folder is that run's
    if (activeRun()) return;
    // the login setup alone (npm run auth) is not a test run worth keeping
    const tests = this.suite.allTests().filter((t) => projectOf(t) !== 'setup');
    if (!tests.length) return;

    const outcomes = tests.map((t) => t.outcome());
    const count = (o: string) => outcomes.filter((x) => x === o).length;
    // knownBug() / pendingDecision() tests that still fail as expected: not "passed"
    const expectedFailure = (prefix: string) =>
      tests.filter((t) => t.outcome() === 'expected' && t.annotations.some((a) => a.type === 'fail' && a.description?.startsWith(prefix))).length;
    const knownBugs = expectedFailure('Known bug');
    const pendingDecisions = expectedFailure('Waiting for PO decision');
    const setupFailed = this.suite.allTests().some((t) => projectOf(t) === 'setup' && t.outcome() === 'unexpected');
    const status = result.status.toUpperCase();
    const folder = `${stamp(this.started)}_${env.name}_${status}`;
    const dir = path.join(REPORTS_DIR, env.app, folder);
    fs.mkdirSync(dir, { recursive: true });

    const title = `${app.name} · ${env.name.toUpperCase()} · ${this.started.toLocaleString()} · ${status}`;

    const summary: RunSummary = {
      app: env.app,
      appName: app.name,
      environment: env.name,
      testedBy: env.qa.name,
      build: env.build.version || undefined,
      release: env.build.release || undefined,
      sprint: env.build.sprint || undefined,
      commit: env.build.commit || undefined,
      fullRun: isFullRun(),
      baseUrl: settings.baseUrl,
      started: this.started.toISOString(),
      durationSec: Math.round(result.duration / 1000),
      status: result.status,
      projects: [...new Set(tests.map(projectOf))],
      total: tests.length,
      passed: count('expected') - knownBugs - pendingDecisions,
      failed: count('unexpected'),
      flaky: count('flaky'),
      skipped: count('skipped'),
      knownBugs,
      pendingDecisions,
      setupFailed,
      command: redact(process.argv.slice(2).join(' ')),
      report: '',
      tests: tests.map((t) => ({
        project: projectOf(t),
        file: path.relative(ROOT_DIR, t.location.file).split(path.sep).join('/'),
        title: t.titlePath().slice(3).join(' › '),
        outcome: t.outcome(),
        note: t.annotations.find((a) => a.type === 'fail')?.description,
      })),
    };
    summary.diff = guarded('compare with the previous run', () => compareWithPrevious(summary), undefined);
    // written before the report is built: an interrupted or failed build still leaves the run listed
    const summaryFile = path.join(dir, 'summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    const built = guarded('build the report', () => buildReport(dir, title, summary.fullRun === true), { file: '', branded: false });
    summary.report = built.file;
    summary.branded = built.branded;
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    const report = built.file;

    guarded('delete old runs', () => removeOldRuns(env.reportArchive.keepDays, env.reportArchive.keepRuns), undefined);
    guarded('update reports/index.html', writeIndex, undefined);
    guarded('update reports/flaky.html', writeFlakyPage, undefined);
    const flaky = summary.tests!.filter((t) => t.outcome === 'flaky');
    if (flaky.length) {
      console.log(`\n${flaky.length} flaky test(s), passed only on a retry:\n${flaky.map((t) => `  [${t.project}] ${t.title}`).join('\n')}`);
    }
    if (summary.diff?.newFailures.length) {
      console.log(`\n${summary.diff.newFailures.length} new failure(s) since the previous run:\n${summary.diff.newFailures.map((t) => `  ${t}`).join('\n')}`);
    }
    if (summary.diff?.fixed.length) console.log(`\n${summary.diff.fixed.length} test(s) fixed since the previous run.`);
    if (setupFailed) console.log('\nLogin setup failed: the other tests did not run (see "Test setup" in the report).');
    console.log(`\nReport saved: ${path.relative(ROOT_DIR, path.join(dir, report || ''))}   (all runs: npm run reports)`);
    return summary;
  }
}

/**
 * Single-file Allure report of this run; falls back to keeping the raw results if Allure fails.
 * Videos and traces are left out of report.html (embedded they make it hundreds of MB, too big to open or send);
 * videos are saved in evidence/ (REPORT_EVIDENCE), linked from each test. Secrets are masked before Allure reads
 * the results (src/report/redact.cjs).
 */
function buildReport(dir: string, title: string, fullRun: boolean): { file: string; branded: boolean } {
  const tmp = path.join(dir, '.allure');
  const results = path.join(dir, '.results');
  separateEvidence(results, path.join(dir, EVIDENCE_DIR));
  // safety net: secrets that still reached the results (error boxes, parameters, attachments) are masked
  redactResultsDir(results);
  const run = spawnSync(process.execPath, [ALLURE_CLI, 'generate', results, '--output', tmp], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      ALLURE_ARCHIVE_TITLE: title,
      // trend and history tabs: shared by the full runs of this app and environment (allurerc.mjs)
      ...(fullRun ? { ALLURE_ARCHIVE_HISTORY: path.join(REPORTS_DIR, env.app, `.history-${env.name}.jsonl`) } : {}),
    },
    encoding: 'utf8',
    timeout: ALLURE_TIMEOUT_MS,
  });
  const html = path.join(tmp, 'index.html');
  if (run.status === 0 && fs.existsSync(html)) {
    fs.rmSync(results, { recursive: true, force: true });
    fs.renameSync(html, path.join(dir, 'report.html'));
    // company colours, logo and header bar (src/report/brand.mjs)
    const brand = spawnSync(process.execPath, [BRAND_SCRIPT, path.join(dir, 'report.html'), '--project', env.app, '--env', env.name], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      timeout: 60_000,
    });
    fs.rmSync(tmp, { recursive: true, force: true });
    if (brand.status !== 0) console.warn('Report archive: the company branding could not be applied; the report is still complete.');
    return { file: 'report.html', branded: brand.status === 0 };
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  // keep the results without videos/traces and with secrets masked (what the report would have shown)
  fs.renameSync(results, path.join(dir, 'allure-results'));
  console.warn(`Report archive: Allure could not build the report, raw results kept instead.\n${run.stderr || run.error || ''}`);
  return { file: '', branded: false };
}

/**
 * Posts the run summary to NOTIFY_WEBHOOK (Teams or Slack incoming webhook: a JSON { text } message).
 * Counts, build, new failures and where the report is; never test data or secrets.
 */
async function notify(s: RunSummary): Promise<void> {
  const ok = s.status === 'passed' && !s.setupFailed;
  const lines = [
    `${ok ? '✅' : '❌'} QA run ${s.setupFailed ? 'LOGIN SETUP FAILED' : s.status.toUpperCase()} · ${s.appName} · ${s.environment.toUpperCase()}` +
      `${s.build ? ` · build ${s.build}` : ''}${s.sprint ? ` · sprint ${s.sprint}` : ''}`,
    `Passed ${s.passed} · Failed ${s.failed} · Known bugs ${s.knownBugs ?? 0} · PO pending ${s.pendingDecisions ?? 0} · Flaky ${s.flaky} · Skipped ${s.skipped} (of ${s.total}) · ${formatDuration(s.durationSec)}`,
    ...(s.diff?.newFailures.length ? [`New failures: ${s.diff.newFailures.slice(0, 10).join('; ')}${s.diff.newFailures.length > 10 ? ' …' : ''}`] : []),
    ...(s.diff?.fixed.length ? [`Fixed since the previous run: ${s.diff.fixed.length}`] : []),
    `Tested by ${s.testedBy ?? '-'} · Report: ${env.notify.reportUrl || `reports/${s.app}/ on ${s.testedBy ?? 'the test machine'}`}`,
  ];
  try {
    const res = await fetch(env.notify.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: redact(lines.join('\n')) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn(`Report archive: the notification webhook answered ${res.status}`);
  } catch (error) {
    console.warn(`Report archive: could not send the notification: ${error}`);
  }
}

/** Runs one archive step; a failure is reported and the other steps still run. */
function guarded<T>(what: string, step: () => T, fallback: T): T {
  try {
    return step();
  } catch (error) {
    console.warn(`Report archive: could not ${what}: ${error}`);
    return fallback;
  }
}

/** Writes a file in one step (temporary file + rename), so a reader never sees half a page. */
function writeAtomic(file: string, content: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

/** Attachment types that stay out of the single-file report. */
const EVIDENCE_TYPES: Record<string, string> = {
  'video/webm': '.webm',
  'application/vnd.allure.playwright-trace': '.trace.zip',
  'application/zip': '.trace.zip',
};

interface AllureNode {
  name?: string;
  attachments?: { name: string; type?: string; source: string }[];
  steps?: AllureNode[];
}

interface AllureResult extends AllureNode {
  start?: number;
  labels?: { name: string; value: string }[];
  links?: { name?: string; url: string; type?: string }[];
}

/**
 * Copies the Allure results to `resultsCopy` without videos and traces. What REPORT_EVIDENCE keeps goes to
 * `evidenceDir` (TC-FP-13.web-chrome.webm, retries: .retry1) and is linked from the test in the report.
 * Traces are dropped unless REPORT_EVIDENCE=trace: they record every typed value (passwords) and the session cookies.
 */
function separateEvidence(resultsCopy: string, evidenceDir: string): void {
  fs.mkdirSync(resultsCopy, { recursive: true });
  const keep = env.reportArchive.evidence;
  const moved = new Map<string, string>(); // attachment file → evidence file name
  const dropped = new Set<string>();
  const files = fs.readdirSync(RESULTS_DIR);

  const results: { file: string; result: AllureResult }[] = [];
  for (const file of files.filter((f) => f.endsWith('-result.json'))) {
    try {
      results.push({ file, result: JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8')) });
    } catch {
      fs.copyFileSync(path.join(RESULTS_DIR, file), path.join(resultsCopy, file)); // half-written (interrupted run)
    }
  }
  // attempt number per test and project, in the order they ran
  const attempts = new Map<string, number>();
  results.sort((a, b) => (a.result.start ?? 0) - (b.result.start ?? 0));
  const label = (r: AllureResult, name: string) => r.labels?.find((l) => l.name === name)?.value;
  const keyOf = (r: AllureResult) => `${r.name}|${label(r, 'parentSuite') ?? 'test'}`;
  const lastAttempt = new Map(results.map(({ result }) => [keyOf(result), result]));

  for (const { file, result } of results) {
    const project = label(result, 'parentSuite') ?? 'test';
    const key = keyOf(result);
    const retry = attempts.get(key) ?? 0;
    attempts.set(key, retry + 1);
    // the final attempt shows the result; an environment failure (server down) has nothing to show
    const wanted = lastAttempt.get(key) === result && !label(result, 'cause')?.startsWith('Environment');
    const strip = (node: AllureNode): void => {
      node.attachments = (node.attachments ?? []).filter((a) => {
        const ext = a.type ? EVIDENCE_TYPES[a.type] : undefined;
        if (!ext) return true;
        const kind = ext === '.webm' ? 'Video' : 'Trace';
        if (wanted && (keep === 'trace' || (keep === 'video' && kind === 'Video'))) {
          const name = evidenceName(result.name ?? 'test', project, retry, ext);
          moved.set(a.source, name);
          (result.links ??= []).push({ name: `${kind}: ${EVIDENCE_DIR}/${name}`, url: `${EVIDENCE_DIR}/${name}`, type: 'link' });
        } else {
          dropped.add(a.source);
        }
        return false;
      });
      node.steps?.forEach(strip);
    };
    strip(result);
    fs.writeFileSync(path.join(resultsCopy, file), JSON.stringify(result));
  }

  for (const file of files.filter((f) => !f.endsWith('-result.json'))) {
    const source = path.join(RESULTS_DIR, file);
    if (dropped.has(file) || !fs.statSync(source).isFile()) continue;
    const evidence = moved.get(file);
    if (!evidence) fs.copyFileSync(source, path.join(resultsCopy, file));
    else {
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.copyFileSync(source, path.join(evidenceDir, evidence));
    }
  }
  if (moved.size) {
    fs.writeFileSync(
      path.join(evidenceDir, 'README.txt'),
      'Videos (.webm) of the failed tests of this run: <test case ID>.<project>[.retryN].webm.\n' +
        'Each failed test in report.html links its video. Open it in a browser or media player.\n' +
        (keep === 'trace'
          ? '\nTraces (.trace.zip, kept because REPORT_EVIDENCE=trace): a step-by-step replay. Drag it onto\n' +
            'https://trace.playwright.dev (stays on your computer) or run: npx playwright show-trace <file>.trace.zip\n' +
            'WARNING: a trace records every value typed (passwords) and the session cookies. Never send traces\n' +
            'outside the QA team, and delete them when the bug is fixed.\n'
          : ''),
    );
  }
}

/**
 * Deletes runs older than keepDays, runs beyond the newest keepRuns per app (0 = no limit for either), and
 * leftover folders without a summary.json (a run killed while it was being saved) older than a day.
 */
/** No --grep, no file or line filter, no --last-failed: every test of the selected projects ran. */
function isFullRun(): boolean {
  const args = process.argv.slice(2);
  const filters = /^(-g|--grep|--grep-invert|--last-failed|--only-changed|--repeat-each)/;
  return !args.some((a, i) => filters.test(a) || (!a.startsWith('-') && i > 0 && !/^-/.test(args[i - 1] ?? '') && a !== 'test'));
}

/** New failures, fixes and still-failing tests compared with the previous run of this app and environment. */
function compareWithPrevious(current: RunSummary): RunDiff | undefined {
  const previous = readRuns().find((r) => r.summary.app === current.app && r.summary.environment === current.environment);
  if (!previous?.summary.tests) return undefined;
  const key = (t: TestOutcome) => `${t.project} › ${t.title}`;
  const before = new Map(previous.summary.tests.map((t) => [key(t), t.outcome]));
  const now = (current.tests ?? []).filter((t) => before.has(key(t)));
  return {
    previous: previous.summary.started,
    newFailures: now.filter((t) => t.outcome === 'unexpected' && before.get(key(t)) !== 'unexpected').map(key),
    fixed: now.filter((t) => t.outcome !== 'unexpected' && t.outcome !== 'skipped' && before.get(key(t)) === 'unexpected').map(key),
    stillFailing: now.filter((t) => t.outcome === 'unexpected' && before.get(key(t)) === 'unexpected').length,
  };
}

function removeOldRuns(keepDays: number, keepRuns: number): void {
  const limit = Date.now() - keepDays * DAY_MS;
  const perApp = new Map<string, number>();
  for (const run of readRuns()) {
    const n = (perApp.get(run.summary.app) ?? 0) + 1;
    perApp.set(run.summary.app, n);
    const tooOld = keepDays > 0 && Date.parse(run.summary.started) < limit;
    if (tooOld || (keepRuns > 0 && n > keepRuns)) fs.rmSync(run.dir, { recursive: true, force: true });
  }
  for (const appDir of fs.existsSync(REPORTS_DIR) ? fs.readdirSync(REPORTS_DIR, { withFileTypes: true }) : []) {
    if (!appDir.isDirectory()) continue;
    const base = path.join(REPORTS_DIR, appDir.name);
    for (const runDir of fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = path.join(base, runDir.name);
      if (!fs.existsSync(path.join(dir, 'summary.json')) && fs.statSync(dir).mtimeMs < Date.now() - DAY_MS) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
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
  <td>${esc(s.testedBy || '-')}</td>
  <td>${esc([s.build, s.sprint ? `sprint ${s.sprint}` : ''].filter(Boolean).join(' · ') || '-')}</td>
  <td><span class="pill ${ok ? 'ok' : 'bad'}">${esc(s.setupFailed ? 'login setup failed' : s.status)}</span></td>
  <td class="n">${s.passed}</td><td class="n${s.failed ? ' red' : ''}">${s.failed}</td><td class="n">${s.flaky}</td>
  <td class="n">${s.knownBugs ?? '-'}</td><td class="n">${s.pendingDecisions ?? '-'}</td><td class="n">${s.skipped}</td>
  <td class="n">${formatDuration(s.durationSec)}</td>
  <td>${s.diff ? esc([s.diff.newFailures.length ? `+${s.diff.newFailures.length} new` : '', s.diff.fixed.length ? `${s.diff.fixed.length} fixed` : ''].filter(Boolean).join(', ') || 'same') : '-'}</td>
  <td>${esc(s.projects.join(', '))}</td>
  <td><code>${esc(s.command || '(all tests)')}</code></td>
  <td>${link}</td>
</tr>`;
    })
    .join('\n');

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  writeAtomic(
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
<input id="q" placeholder="Filter: app, environment, tester, status, date, command..." oninput="filter()">
<div class="wrap"><table>
<thead><tr><th>Started</th><th>App</th><th>Env</th><th>Tested by</th><th>Build</th><th>Status</th><th>Passed</th><th>Failed</th><th>Flaky</th><th title="knownBug(): ticketed bug, still failing">Known bugs</th><th title="pendingDecision(): waiting for the PO">PO pending</th><th>Skipped</th><th>Duration</th><th title="Compared with the previous run of this app and environment">vs previous</th><th>Projects</th><th>Command</th><th>Report</th></tr></thead>
<tbody id="runs">
${rows || '<tr><td colspan="17" class="muted">No runs saved yet.</td></tr>'}
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
  writeAtomic(
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
