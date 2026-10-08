import { defineConfig } from 'allure';
import { BRAND, LOGO, setting } from './src/report/brand.mjs';

const app = setting('APP', 'app');
const testEnv = setting('TEST_ENV', 'qa');
const reportName = `${BRAND.company} · ${app} · ${testEnv.toUpperCase()} · Test report`;
/** Company colours are blue on white, so light theme only (colours and header bar: src/report/brand.mjs). */
const look = { logo: LOGO, theme: 'light', reportLanguage: 'en' };

/**
 * Failed tests are sorted by their likely cause. The framework sets a `cause` label on every failure
 * ("Product bug: wrong text or value", "Automation issue: element not found", ...; see src/report/bugReport.ts),
 * so developers open "Product bugs" and QA opens "Automation issues".
 */
const categories = [
  // knownBug() / pendingDecision() tests whose result changed: QA acts on these first
  {
    name: 'Known bug appears fixed: check Jira, remove knownBug',
    matchers: { labels: { cause: /^Known bug: .* appears fixed/ } },
    groupBy: [{ label: 'feature' }],
    groupByMessage: false,
    expand: true,
  },
  {
    name: 'Known bug test failed somewhere else: possible new problem',
    matchers: { labels: { cause: /^Known bug: .*different failure/ } },
    groupByMessage: false,
    expand: true,
  },
  {
    name: 'App now matches the test case: remove pendingDecision',
    matchers: { labels: { cause: /^PO decision:/ } },
    groupByMessage: false,
  },
  {
    name: 'Product bugs: app behaves differently from the test case',
    matchers: { labels: { cause: /^Product bug/ } },
    groupBy: [{ label: 'cause' }, { label: 'feature' }],
    groupByMessage: false,
    expand: true,
  },
  {
    name: 'Automation issues: QA to fix the test',
    matchers: { labels: { cause: /^Automation issue/ } },
    groupBy: [{ label: 'cause' }],
    groupByMessage: false,
  },
  {
    name: 'Environment problems: server down or too slow',
    matchers: { labels: { cause: /^Environment/ } },
    groupBy: [{ label: 'cause' }],
    groupByMessage: false,
  },
  {
    name: 'Needs triage: QA decides (app bug or changed locator)',
    matchers: { labels: { cause: /^Needs triage/ } },
    groupBy: [{ label: 'feature' }],
    groupByMessage: false,
  },
  { name: 'Other failures', matchers: { statuses: ['failed', 'broken'] }, groupByMessage: true },
  // expected failures, shown so they are never mistaken for passed tests
  {
    name: 'Known bugs (ticketed, still failing)',
    matchers: { labels: { known_bug: /.+/ } },
    groupBy: [{ label: 'known_bug' }],
    groupByMessage: false,
  },
  {
    name: 'Waiting for PO decision',
    matchers: { labels: { pending_decision: /.+/ } },
    groupBy: [{ label: 'pending_decision' }],
    groupByMessage: false,
    expand: true,
  },
  { name: 'Flaky: passed only after a retry', matchers: { flaky: true } },
];

/**
 * Archive mode (src/report/archive.ts sets ALLURE_ARCHIVE_TITLE after every run): one self-contained
 * report.html that opens with a double-click, without touching the shared trend history.
 */
const archiveTitle = process.env.ALLURE_ARCHIVE_TITLE;

/** The normal report: npm run report. */
const liveReport = defineConfig({
  name: reportName,
  output: './allure-report',
  historyPath: './allure-history.jsonl',
  categories,
  plugins: {
    awesome: {
      options: {
        ...look,
        reportName,
        // tree on the left follows Jira: Epic → Feature → Story → test
        groupBy: ['epic', 'feature', 'story'],
      },
    },
    // charts for leads: status trend, severity, duration
    dashboard: { options: { ...look, reportName: `${reportName} · Dashboard` } },
  },
});

const archivedReport = defineConfig({
  name: archiveTitle,
  // full runs share a trend/history per app and environment (set by archive.ts); partial runs have none
  ...(process.env.ALLURE_ARCHIVE_HISTORY ? { historyPath: process.env.ALLURE_ARCHIVE_HISTORY } : {}),
  categories,
  plugins: {
    awesome: {
      options: { ...look, reportName: archiveTitle, groupBy: ['epic', 'feature', 'story'], singleFile: true },
    },
  },
});

export default archiveTitle ? archivedReport : liveReport;
