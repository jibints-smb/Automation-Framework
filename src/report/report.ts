/**
 * Report enrichment for every test, run by the core `report` fixture (no code needed in specs):
 *
 *   all tests     description = the test case (preconditions, steps, expected result) from the
 *                 *.testcases.md file, severity from its priority, platform and role as parameters
 *   failed tests  a summary at the top of the test (cause, expected vs actual, failed step), a `cause`
 *                 label for the Categories view and an attached "Bug report" page for developers
 */
import type { TestInfo } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { settings } from '@core/config/app';
import { env } from '@core/config/env';
import { jiraUrl } from '@core/utils/allure';
import { redact } from '@core/utils/redact';
import {
  buildBugReport,
  causeLabel,
  classifyFailure,
  failingStep,
  parseError,
  testCaseMismatch,
  type FailureCause,
} from './bugReport';
import { resetRunLog, runLog } from './runLog';
import { findTestCase, type TestCase } from './testCases';

const SEVERITY: Record<string, string> = {
  blocker: 'blocker',
  critical: 'critical',
  high: 'critical',
  major: 'critical',
  normal: 'normal',
  medium: 'normal',
  minor: 'minor',
  low: 'minor',
  trivial: 'trivial',
};

export async function startTestReport(testInfo: TestInfo, role: string | null): Promise<TestCase | undefined> {
  resetRunLog();
  const tc = findTestCase(testInfo.title, testInfo.file);
  if (tc) await allure.descriptionHtml(describeTestCase(tc));
  // excluded: shown in the report, but not part of the test's identity (keeps history intact)
  await allure.parameter('Logged in as', role ?? 'logged out', { excluded: true });
  // the QA who ran it (QA_NAME): "Owner" in the test details, filterable in the report
  await allure.owner(env.qa.name);
  return tc;
}

export async function finishTestReport(testInfo: TestInfo, tc: TestCase | undefined, role: string | null): Promise<void> {
  const log = runLog;

  // Specs without storyInfo() still get Epic / Feature / Jira from the test-cases file header.
  if (!log.story && tc) {
    if (tc.header.epic) await allure.epic(tc.header.epic);
    if (tc.header.feature) await allure.feature(tc.header.feature);
    if (tc.header.jira) await allure.issue(jiraUrl(tc.header.jira), tc.header.jira);
  }
  // only when known; Allure shows "normal" for tests without one
  const severity = SEVERITY[tc?.priority ?? ''] ?? SEVERITY[log.story?.severity ?? ''];
  if (severity) await allure.severity(severity);
  // knownBug / pendingDecision: listed in their own report categories and counted apart from passed tests
  if (log.knownBug) {
    await allure.issue(jiraUrl(log.knownBug.key), `Known bug ${log.knownBug.key}`);
    await allure.tag('known-bug');
    await allure.label('known_bug', `${log.knownBug.key}${log.knownBug.summary ? `: ${log.knownBug.summary}` : ''}`);
  }
  if (log.pending) {
    await allure.tag('pending-decision');
    await allure.label('pending_decision', `${log.pending.id}: ${log.pending.reason}`);
  }

  // passed only on a retry: flaky (also listed across runs in reports/flaky.html)
  if (testInfo.retry > 0 && testInfo.status === testInfo.expectedStatus) await allure.tag('flaky');

  // a knownBug / pendingDecision test that passes: the app now does what the test case says
  const expectedToFail = log.knownBug ?? log.pending;
  if (expectedToFail && testInfo.status === 'passed') {
    const cause = resolvedCause(log);
    await allure.label('cause', causeLabel(cause));
    await allure.descriptionHtml(failureSummary(cause, {}) + (tc ? describeTestCase(tc) : ''));
    return;
  }

  const raw = redact(testInfo.errors.map((e) => e.message ?? e.value ?? '').filter(Boolean).join('\n\n') || 'Unknown error');
  const error = parseError(raw);
  const step = failingStep(log.steps);
  // a known bug that fails somewhere else than the bug describes: report it, don't let the bug hide it
  const failsAt = log.knownBug?.failsAt;
  const differentFailure = !!failsAt && testInfo.status === 'failed' && !failsAt.test(`${raw}\n${step?.title ?? ''}`);
  const failed = (testInfo.status !== testInfo.expectedStatus && testInfo.status !== 'skipped') || differentFailure;
  if (!failed) return;

  const cause = differentFailure
    ? {
        group: 'Known bug' as const,
        name: `${log.knownBug!.key}: different failure`,
        hint: `The test is marked with known bug ${log.knownBug!.key}, but it failed somewhere else (expected the error to match /${failsAt!.source}/). Check for a new problem below.`,
      }
    : (testCaseMismatch(error.expected, tc, error.message) ?? classifyFailure(error.message, step?.title));
  await allure.label('cause', causeLabel(cause));

  const report = buildBugReport({
    testInfo,
    testCase: tc,
    log,
    severity: severity ?? 'normal',
    cause,
    error,
    env: { app: env.app, name: env.name, baseUrl: settings.baseUrl, role },
  });
  const summary = failureSummary(cause, {
    step: step?.title,
    expected: error.expected ?? tc?.expected,
    testCaseExpected: error.expected ? tc?.expected : undefined,
    actual: error.received ?? error.message.split('\n')[0],
  });
  await allure.descriptionHtml(summary + (tc ? describeTestCase(tc) : ''));
  await testInfo.attach('Bug report', { body: report.html, contentType: 'text/html' });
  await testInfo.attach('Bug report (text for Jira)', { body: report.text, contentType: 'text/plain' });
}

function resolvedCause(log: typeof runLog): FailureCause {
  if (log.knownBug) {
    return {
      group: 'Known bug',
      name: `${log.knownBug.key} appears fixed`,
      hint: `The test passed although it is marked with known bug ${log.knownBug.key}. Check the bug in Jira; if it is fixed, remove knownBug(...) from the test.`,
    };
  }
  return {
    group: 'PO decision',
    name: `${log.pending!.id} now matches the test case`,
    hint: `The app now does what the test case expects (${log.pending!.id}: ${log.pending!.reason}). Remove pendingDecision(...) and update the sprint Differences table.`,
  };
}

function describeTestCase(tc: TestCase): string {
  const meta = [tc.id, tc.type, tc.priority].filter(Boolean).join(' · ');
  return [
    `<p><b>What this test checks</b> <small>(${esc(meta)})</small></p>`,
    tc.preconditions.length ? `<p><b>Preconditions</b></p><ul>${tc.preconditions.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '',
    tc.steps.length ? `<p><b>Steps</b></p><ol>${tc.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '',
    tc.expected ? `<p><b>Expected result</b><br>${esc(tc.expected)}</p>` : '',
    `<p><small>Test case: ${esc(tc.file)}${tc.header.source ? ` · Requirement: ${esc(tc.header.source)}` : ''}</small></p>`,
  ].join('');
}

function failureSummary(
  cause: FailureCause,
  f: { step?: string; expected?: string; testCaseExpected?: string; actual?: string },
): string {
  return [
    `<p><b>❌ ${esc(causeLabel(cause))}</b><br>${esc(cause.hint)}</p>`,
    `<ul>`,
    f.step ? `<li><b>Failed at:</b> ${esc(f.step)}</li>` : '',
    `<li><b>Expected:</b> ${esc(f.expected ?? '—')}</li>`,
    f.testCaseExpected ? `<li><b>Test case expected result:</b> ${esc(f.testCaseExpected)}</li>` : '',
    `<li><b>Actual:</b> ${esc(f.actual ?? '—')}</li>`,
    `</ul>`,
    `<p><small>The Bug report and screenshot are attached below; the video too in the live report. In a saved run, the video is in the run's evidence/ folder (named in the Bug report).</small></p><hr>`,
  ].join('');
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
