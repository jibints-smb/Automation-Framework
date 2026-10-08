/**
 * The "Bug report" attached to every failed test: a one-page summary a developer can act on without
 * reading test code. Likely cause, expected vs actual, the steps that were really executed (with the test
 * data), where it failed, environment, browser console and failed API calls, and a Jira-ready text copy.
 */
import type { TestInfo } from '@playwright/test';
import { EVIDENCE_DIR, evidenceName } from './evidence';
import type { RunLog, StepEntry } from './runLog';
import type { TestCase } from './testCases';

/**
 * Product bug: for developers · Automation issue: QA fixes the test · Environment: re-run / check the server ·
 * Needs triage: QA decides (could be either) · Known bug / PO decision: knownBug() / pendingDecision() tests.
 */
export type CauseGroup = 'Product bug' | 'Automation issue' | 'Environment' | 'Needs triage' | 'Known bug' | 'PO decision';

export interface FailureCause {
  group: CauseGroup;
  name: string;
  /** What to do next, shown in the report. */
  hint: string;
}

/** `cause` label value, used by the Categories view (allurerc.mjs): "<group>: <name>". */
export const causeLabel = (c: FailureCause) => `${c.group}: ${c.name}`;

const NOT_FOUND = /element\(s\) not found|resolved to 0 elements|was not displayed|no such element/i;

/**
 * Best guess at why a test failed, from the failing framework step and the error message.
 * Step titles come from WebAssertions/MobileAssertions ("Verify ... has text ..."), so this works for every app.
 */
export function classifyFailure(message: string, failingStep = ''): FailureCause {
  const verify = /^Verify\b/.test(failingStep);

  if (/Missing setting|Unknown role|not configured|APP is not set|Unknown APP|Mail login failed/i.test(message)) {
    return { group: 'Automation issue', name: 'setup or configuration', hint: 'Check the app .env and app.config.ts (accounts, URLs, roles, MAIL_* test mailbox).' };
  }
  if (/net::ERR_(?!ABORTED)|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up|getaddrinfo|502 Bad Gateway|503 Service/i.test(message)) {
    return { group: 'Environment', name: 'application or server unreachable', hint: 'Check that the QA environment and its APIs are up, then re-run.' };
  }
  if (/strict mode violation/i.test(message)) {
    return { group: 'Automation issue', name: 'locator matches several elements', hint: 'Make the test ID unique on the page (lists: append the record ID), or narrow the locator in the model.' };
  }
  const special = classifyCheck(message, failingStep);
  if (special) return special;
  if (verify && /is (visible|hidden|enabled|disabled|checked|unchecked)$|^Verify \d+ x /.test(failingStep)) {
    if (!/is (visible|hidden)$/.test(failingStep) && NOT_FOUND.test(message)) return elementNotFound();
    if (/is visible$/.test(failingStep) && NOT_FOUND.test(message)) {
      return {
        group: 'Needs triage',
        name: 'element not on the page',
        hint: 'The element was not found. Either the app does not show it (product bug) or its test ID / locator changed (QA updates the model). Check the screenshot, then raise a bug or fix the model.',
      };
    }
    return { group: 'Product bug', name: 'wrong element state', hint: 'An element is shown, hidden, enabled or checked differently from the expected result.' };
  }
  if (verify && NOT_FOUND.test(message)) return elementNotFound();
  if (/^Verify (URL|page title)/.test(failingStep)) {
    return { group: 'Product bug', name: 'wrong page or URL', hint: 'The app ended on a different page than the expected result.' };
  }
  if (verify) {
    return { group: 'Product bug', name: 'wrong text or value', hint: 'The app shows a different text or value than the spec. Compare Expected and Actual below.' };
  }
  if (NOT_FOUND.test(message) || (failingStep && /Timeout \d+ms exceeded/.test(message))) return elementNotFound();
  if (/expect\(|Expected|toBe|toEqual|toContain|toMatch/.test(message)) {
    return { group: 'Product bug', name: 'unexpected result', hint: 'A check in the test did not get the expected result. Compare Expected and Actual below.' };
  }
  if (/Test timeout of \d+ms exceeded/.test(message)) {
    return { group: 'Environment', name: 'slow response or test timeout', hint: 'The app or environment was too slow. Re-run; if it repeats, check performance or the loading state.' };
  }
  return { group: 'Automation issue', name: 'error in test code', hint: 'The test itself threw an error. QA checks the stack trace below.' };
}

/** Accessibility, visual, performance, API and email checks: their own causes and next steps. */
function classifyCheck(message: string, failingStep: string): FailureCause | undefined {
  if (/^Wait for email to/.test(failingStep)) {
    return {
      group: 'Environment',
      name: 'email not delivered',
      hint: 'The app did not send the email in time (inbox, spam and All Mail were checked). Check the QA email service and re-run; if it never arrives after the action, it is a product bug.',
    };
  }
  if (/^Wait until ".*" is gone/.test(failingStep)) {
    return {
      group: 'Environment',
      name: 'loading took too long',
      hint: 'A loading indicator (spinner, splash) stayed on screen past the limit: the environment was slow. Re-run; if it repeats, raise the slow load with the timings.',
    };
  }
  if (/^Read the (one-time code|link)/.test(failingStep)) {
    return {
      group: 'Automation issue',
      name: 'code or link not found in the email',
      hint: 'The email arrived but its format is not what the test expects: check the "Email:" attachment and pass { pattern } / the link text to otpFrom / linkFrom.',
    };
  }
  if (/^Verify page is accessible/.test(failingStep)) {
    return {
      group: 'Product bug',
      name: 'accessibility violation',
      hint: 'The page breaks WCAG rules: see the "Accessibility report" attachment for the elements. A known, ticketed issue can be ignored in app.config.ts checks.accessibility.ignoreRules.',
    };
  }
  // reported after the test ends, not inside the step, so matched on the message alone
  if (/A snapshot doesn't exist at .*writing actual/i.test(message)) {
    return {
      group: 'Automation issue',
      name: 'no approved screenshot yet',
      hint: 'First run on this project/OS: the screenshot was saved to apps/<app>/screenshots/. Check that it looks right and commit it; the next run compares against it.',
    };
  }
  if (/^Verify .* looks like "/.test(failingStep)) {
    return {
      group: 'Product bug',
      name: 'visual change',
      hint: 'The screen looks different from the approved screenshot: compare the expected, actual and diff images. If the change is intended, approve it with npm run visual:update -- <spec>.',
    };
  }
  if (/^Verify page load is within/.test(failingStep)) {
    return {
      group: 'Product bug',
      name: 'performance budget exceeded',
      hint: 'The page loaded slower or heavier than its budget (timings in the "Performance" attachment). Re-run first: a slow QA environment causes this too. If it repeats, report it with the timings.',
    };
  }
  if (/^API [A-Z]+ /.test(failingStep)) {
    if (/does not match the schema/.test(message)) {
      return { group: 'Product bug', name: 'API response breaks the contract', hint: 'A field is missing, renamed or has the wrong type compared with the schema. Check whether the API or the schema (models/api) is out of date.' };
    }
    if (/returned 40[13]\b/.test(message)) {
      return { group: 'Automation issue', name: 'API not authorised', hint: 'Check API_TOKEN / the role used for the call in the app .env.' };
    }
    if (/returned 5\d\d\b/.test(message)) {
      return { group: 'Product bug', name: 'API server error', hint: 'The API failed with a 5xx error: attach the response body shown below to the bug.' };
    }
    if (/returned \d{3}\b/.test(message)) {
      return { group: 'Product bug', name: 'API returned an unexpected status', hint: 'Compare the status and response body with the expected result in the test case.' };
    }
    if (/ took \d+ ms \(limit/.test(message)) {
      return { group: 'Product bug', name: 'API too slow', hint: 'The response time exceeded its limit. Re-run first; if it repeats, report it with the timing.' };
    }
  }
  return undefined;
}

function elementNotFound(): FailureCause {
  return {
    group: 'Automation issue',
    name: 'element not found',
    hint: 'The element was not on the screen in time. Either the UI or test ID changed (QA updates the model), or the screen did not appear (possible bug, check the screenshot).',
  };
}

export const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

/** Splits a Playwright error into the message, the "Expected"/"Received" lines and the call log. */
export function parseError(raw: string): { message: string; expected?: string; received?: string; callLog?: string } {
  const text = stripAnsi(raw).trim();
  const [message, callLog] = text.split(/\n\s*Call log:\s*\n/);
  const pick = (re: RegExp) => message.match(re)?.[1]?.trim();
  return {
    message: message.trim(),
    expected: pick(/^\s*Expected(?: string| pattern| substring| value)?:\s*(.+)$/m),
    received: pick(/^\s*Received(?: string| value)?:\s*(.+)$/m),
    callLog: callLog?.trim(),
  };
}

/** The deepest failed step: where the test actually stopped. A step still "running" means a timeout. */
export function failingStep(steps: StepEntry[]): StepEntry | undefined {
  const failed = steps.filter((s) => s.status !== 'passed');
  return failed[failed.length - 1];
}

/**
 * If the test case gives exact texts in quotes and the test checked none of them, the test itself is
 * wrong (old text, typo in test data), not the app.
 */
export function testCaseMismatch(checked: string | undefined, tc: TestCase | undefined, message = ''): FailureCause | undefined {
  // only exact text / value checks: substring, pattern, URL and count checks can't be compared with the test case
  if (!/toHaveText|toHaveValue/.test(message) || /Expected (pattern|substring)/.test(message)) return undefined;
  const value = norm(unquote(checked));
  const quoted = [...(tc?.expected ?? '').matchAll(/"([^"]+)"/g)].map((m) => norm(m[1]));
  if (!value || !quoted.length || quoted.some((q) => q === value || q.includes(value) || value.includes(q))) return undefined;
  return {
    group: 'Automation issue',
    name: 'test checks a different value than the test case',
    hint: `The test case expects ${tc!.expected}, but the test checked "${value}". QA updates the test data or model; this is not an app bug.`,
  };
}

const unquote = (s?: string) => s?.trim().replace(/^"(.*)"$/s, '$1');
const norm = (s?: string) => (s ?? '').replace(/s+/g, ' ').trim().toLowerCase();

export interface BugReportInput {
  testInfo: TestInfo;
  testCase?: TestCase;
  log: RunLog;
  severity: string;
  cause: FailureCause;
  error: ReturnType<typeof parseError>;
  env: { app: string; name: string; baseUrl: string; role: string | null };
}

export function buildBugReport(input: BugReportInput): { html: string; text: string } {
  const { testInfo, testCase: tc, log, severity, cause, error, env } = input;
  const failed = failingStep(log.steps);
  const title = testInfo.title;
  const feature = log.story?.feature ?? tc?.header.feature;
  const jira = log.story?.jira ?? tc?.header.jira;
  const where = log.device ?? (log.web ? `${testInfo.project.name} (${log.web.browser})` : testInfo.project.name);
  const attempt = testInfo.project.retries ? `${testInfo.retry + 1} of ${testInfo.project.retries + 1}` : '1';
  // what the test really checked; the test case's wording is shown under it
  const expected = error.expected ?? tc?.expected;
  const tcExpected = error.expected && tc?.expected ? tc.expected : undefined;
  const actual = error.received ?? firstLine(error.message);
  const video = evidenceName(title, testInfo.project.name, testInfo.retry, '.webm');
  const bugTitle = `${feature ? `[${feature}] ` : ''}${tc?.title ?? title.replace(/^\s*TC-[A-Z0-9-]+\s*\|\s*/i, '')}${tc ? ` (${tc.id})` : ''}`;

  const facts: [string, string][] = [
    ['Story / test case', [jira, tc?.id].filter(Boolean).join(' · ') || '—'],
    ['Severity', severity],
    ['Environment', `${env.name.toUpperCase()} · ${env.baseUrl || '—'}`],
    ['Platform', where],
    ['Logged in as', env.role ?? 'logged out'],
    ...(log.web?.url ? [['Page at failure', log.web.url] as [string, string]] : []),
    ['Failed at step', failed ? failed.title + (failed.status === 'running' ? ' (did not finish: timeout)' : '') : '—'],
    ['Attempt', attempt],
    ['Run at', new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })],
    ['Spec', `${testInfo.file.replace(/\\/g, '/').replace(/^.*?(apps\/)/, '$1')}:${testInfo.line}`],
  ];

  const text = [
    `Title: ${bugTitle}`,
    '',
    ...facts.filter(([k]) => k !== 'Spec').map(([k, v]) => `${k}: ${v}`),
    '',
    ...(tc?.preconditions.length ? ['Preconditions:', ...tc.preconditions.map((p) => `- ${p}`), ''] : []),
    'Steps to reproduce:',
    ...numbered(log.steps).map(({ n, step: s }) => `${'   '.repeat(s.depth)}${n} ${s.title}${s === failed ? '   <-- fails here' : ''}`),
    '',
    `Expected: ${expected ?? '—'}`,
    ...(tcExpected ? [`Test case expected result: ${tcExpected}`] : []),
    `Actual: ${actual ?? '—'}`,
    '',
    `Evidence: screenshot attached to this test in the report; video: ${video} (in the run's ${EVIDENCE_DIR}/ folder; attached to the test in the live report).`,
  ].join('\n');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div class="head ${cssGroup(cause.group)}">
  <div class="kicker">${esc(cause.group)} · ${esc(cause.name)}</div>
  <h1>${esc(bugTitle)}</h1>
  <p>${esc(cause.hint)}</p>
</div>

<div class="cmp">
  <div class="box exp"><h3>Expected</h3><div>${esc(expected ?? '—')}</div><small>${tcExpected ? `test case: ${esc(tcExpected)}` : tc ? 'from the test case' : 'what the test checked'}</small></div>
  <div class="box act"><h3>Actual</h3><div>${esc(actual ?? '—')}</div><small>what the app did</small></div>
</div>

<h2>Steps to reproduce</h2>
${tc?.preconditions.length ? `<p class="pre"><b>Preconditions:</b> ${tc.preconditions.map(esc).join(' ')}</p>` : ''}
<ul class="steps">${numbered(log.steps)
    .map(
      ({ n, step: s }) =>
        `<li class="d${Math.min(s.depth, 3)}${s === failed ? ' fail' : ''}"><span class="n">${n}</span>${esc(s.title)}${s === failed ? `<span class="here">${s.status === 'running' ? 'timed out here' : 'fails here'}</span>` : ''}</li>`,
    )
    .join('')}</ul>
${log.steps.length ? '' : '<p class="muted">No framework steps were recorded before the failure.</p>'}

<h2>Details</h2>
<table>${facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>

${list('Browser console errors', log.web?.consoleErrors)}
${list('Failed network requests (4xx / 5xx / no response)', log.web?.failedRequests)}

<h2>Error</h2>
<pre>${esc(error.message)}</pre>
${error.callLog ? `<details><summary>Playwright call log</summary><pre>${esc(error.callLog)}</pre></details>` : ''}

<details><summary>Copy for Jira</summary><pre>${esc(text)}</pre></details>
<p class="muted">${log.device ? 'Screenshot and page source are attached below this report.' : `Screenshot attached below this report. Video: <b>${esc(video)}</b> in the run's ${EVIDENCE_DIR}/ folder (next to report.html), or attached below in the live report.`}</p>
</body></html>`;

  return { html, text };
}

/** Outline numbers for the step tree: 1, 2, 2.1, 2.2, 3 ... (nested steps show the exact data entered). */
function numbered(steps: StepEntry[]): { n: string; step: StepEntry }[] {
  const counters: number[] = [];
  return steps.map((step) => {
    counters.length = step.depth + 1;
    counters[step.depth] = (counters[step.depth] ?? 0) + 1;
    return { n: counters.map((c) => c ?? 1).join('.'), step };
  });
}

function list(title: string, items?: string[]): string {
  if (!items?.length) return '';
  return `<h2>${esc(title)}</h2><ul class="log">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

const firstLine = (s: string) => s.split('\n')[0];
const cssGroup = (g: CauseGroup) =>
  g === 'Product bug' || g === 'Known bug' ? 'bug' : g === 'Environment' || g === 'PO decision' ? 'env' : 'auto';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const CSS = `
body{font:14px/1.5 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;color:#1c2430;margin:0;padding:16px;background:#fff}
h1{font-size:18px;margin:4px 0 6px}h2{font-size:14px;margin:20px 0 8px;color:#1f4e79;text-transform:uppercase;letter-spacing:.04em}
h3{margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.head{border-radius:8px;padding:14px 16px;border-left:5px solid}.head p{margin:0}
.head .kicker{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.bug{background:#fbeaea;border-color:#a12828}.bug .kicker{color:#a12828}
.auto{background:#fdf3e2;border-color:#9a5b00}.auto .kicker{color:#9a5b00}
.env{background:#e8f0f8;border-color:#1f4e79}.env .kicker{color:#1f4e79}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
@media (max-width:560px){.cmp{grid-template-columns:1fr}}
.box{border:1px solid #d9dee6;border-radius:8px;padding:10px 12px;word-break:break-word}.box div{font-weight:600}
.box small{color:#5b6676}.exp h3{color:#0f7b6c}.act h3{color:#a12828}
.steps{list-style:none;padding:0;margin:0}.steps li{padding:3px 0}
.steps .n{display:inline-block;min-width:34px;color:#5b6676;font-variant-numeric:tabular-nums}
.steps .d1{padding-left:24px;font-size:13px;color:#3a4553}.steps .d2,.steps .d3{padding-left:48px;font-size:13px;color:#3a4553}
.steps li.fail{color:#a12828;font-weight:600}
.here{margin-left:8px;font-size:11px;background:#a12828;color:#fff;border-radius:10px;padding:1px 8px;font-weight:600}
.pre{margin:0 0 6px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #d9dee6;padding:5px 8px;text-align:left;vertical-align:top;word-break:break-word}
th{background:#f4f6f9;width:28%;font-weight:600}
pre{background:#f4f6f9;border:1px solid #d9dee6;border-radius:6px;padding:10px;white-space:pre-wrap;word-break:break-word;font:12px/1.45 Consolas,monospace}
details{margin-top:10px}summary{cursor:pointer;color:#1f4e79;font-weight:600}
.log{font:12px/1.45 Consolas,monospace;padding-left:18px}.muted{color:#5b6676;font-size:12px}
`;
