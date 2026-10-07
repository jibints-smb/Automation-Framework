import fs from 'node:fs';
import { defineConfig } from 'allure';

/** APP / TEST_ENV from the command line or the root .env, for the report title. */
function setting(name, fallback) {
  if (process.env[name]) return process.env[name];
  const rootEnv = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  return rootEnv.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1].trim() || fallback;
}

const app = setting('APP', 'app');
const testEnv = setting('TEST_ENV', 'qa');
const reportName = `${app} · ${testEnv.toUpperCase()} · Test report`;

/**
 * Failed tests are sorted by their likely cause. The framework sets a `cause` label on every failure
 * ("Product bug: wrong text or value", "Automation issue: element not found", ...; see src/report/bugReport.ts),
 * so developers open "Product bugs" and QA opens "Automation issues".
 */
const categories = [
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
  { name: 'Other failures', matchers: { statuses: ['failed', 'broken'] }, groupByMessage: true },
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
        reportName,
        reportLanguage: 'en',
        theme: 'auto',
        // tree on the left follows Jira: Epic → Feature → Story → test
        groupBy: ['epic', 'feature', 'story'],
      },
    },
    // charts for leads: status trend, severity, duration
    dashboard: { options: { reportName: `${reportName} · Dashboard`, reportLanguage: 'en', theme: 'auto' } },
  },
});

const archivedReport = defineConfig({
  name: archiveTitle,
  categories,
  plugins: {
    awesome: {
      options: { reportName: archiveTitle, reportLanguage: 'en', theme: 'auto', groupBy: ['epic', 'feature', 'story'], singleFile: true },
    },
  },
});

export default archiveTitle ? archivedReport : liveReport;
