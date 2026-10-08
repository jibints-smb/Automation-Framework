/**
 * Environment settings: the only place that reads `process.env`.
 *
 * Which application is tested comes from `APP` (root `.env` or the command line):
 *   APP=saucedemo npm test
 * Settings are then loaded, first value wins (a mistyped TEST_ENV without its .env file stops the run):
 *   1. real environment variables (CI secrets)
 *   2. apps/<APP>/.env.<TEST_ENV>   e.g. .env.staging
 *   3. apps/<APP>/.env
 *   4. root .env                     shared settings such as JIRA_BASE_URL
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

export const ROOT_DIR = path.resolve(__dirname, '../..');
const APPS_DIR = path.join(ROOT_DIR, 'apps');

// The root .env holds APP and TEST_ENV, so it is read first, but applied last: app settings win (order above).
const ROOT_ENV_FILE = path.join(ROOT_DIR, '.env');
const rootSettings: Record<string, string> = fs.existsSync(ROOT_ENV_FILE) ? dotenv.parse(fs.readFileSync(ROOT_ENV_FILE)) : {};
const rootSetting = (name: string): string | undefined => process.env[name] ?? rootSettings[name];
/** TEST_ENV when none is set: uses apps/<app>/.env alone. */
const DEFAULT_TEST_ENV = 'qa';

function listApps(): string[] {
  return fs.existsSync(APPS_DIR)
    ? fs.readdirSync(APPS_DIR).filter((name) => fs.existsSync(path.join(APPS_DIR, name, 'app.config.ts')))
    : [];
}

function resolveApp(): string {
  const apps = listApps();
  const app = rootSetting('APP') ?? (apps.length === 1 ? apps[0] : undefined);
  if (!app || !apps.includes(app)) {
    throw new Error(
      `${app ? `Unknown APP "${app}"` : 'APP is not set'}. Set APP in the root .env or run e.g. "APP=${apps[0] ?? 'my-app'} npm test". ` +
        `Available apps: ${apps.join(', ') || 'none (create one with npm run new:app <name>)'}`,
    );
  }
  return app;
}

const appName = resolveApp();
const testEnv = rootSetting('TEST_ENV') || DEFAULT_TEST_ENV;
export const APP_DIR = path.join(APPS_DIR, appName);

// a mistyped TEST_ENV (stagin, UAT) must not quietly run against the default environment
const envFile = path.join(APP_DIR, `.env.${testEnv}`);
if (testEnv !== DEFAULT_TEST_ENV && !fs.existsSync(envFile)) {
  throw new Error(
    `TEST_ENV=${testEnv}, but apps/${appName}/.env.${testEnv} doesn't exist. Create it with that environment's BASE_URL and ` +
      `accounts (start from apps/${appName}/.env), or fix TEST_ENV. TEST_ENV=${DEFAULT_TEST_ENV} uses apps/${appName}/.env.`,
  );
}
dotenv.config({ path: [envFile, path.join(APP_DIR, '.env'), ROOT_ENV_FILE], quiet: true });

/** Read any setting (empty string when not set). Use for app-specific variables. */
export function getEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

/** Every loaded setting, for redacting secret values from reports (src/utils/redact.ts). */
export function allSettings(): Record<string, string | undefined> {
  return { ...process.env };
}

/** A whole-number setting; fails with a clear message instead of running with NaN. */
export function numberSetting(name: string, fallback: number): number {
  const raw = getEnv(name).trim();
  if (raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`Setting ${name}=${raw} must be a whole number (0 or more)`);
  return value;
}

/** Read a setting that must be present; fails with a clear message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing setting ${name} in apps/${appName}/.env.${testEnv} or apps/${appName}/.env`);
  return value;
}

/** Short commit of the test code (this repository), so a run can be reproduced; empty outside git. */
function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** QA_NAME, else the git user name, else the OS user: a run is never anonymous. */
function resolveQaName(): string {
  const name = process.env.QA_NAME?.trim();
  if (name) return name;
  try {
    const gitName = execSync('git config user.name', { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (gitName) return gitName;
  } catch {
    // no git or no user.name: fall through
  }
  return os.userInfo().username;
}

/**
 * Fail fast with a clear message when settings a test needs are empty.
 * @example requireSettings({ MOBILE_USERNAME: env.mobile.username });
 */
export function requireSettings(settings: Record<string, string>): void {
  const missing = Object.entries(settings)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) throw new Error(`Missing settings in apps/${appName}/.env: ${missing.join(', ')}`);
}

export const env = {
  app: appName,
  name: testEnv,

  /** Override the app's defaults from app.config.ts per environment. */
  web: {
    baseUrl: getEnv('BASE_URL'),
    testIdAttribute: getEnv('TEST_ID_ATTRIBUTE'),
  },

  api: {
    baseUrl: getEnv('API_BASE_URL'),
    /** Sent as `Authorization: Bearer <token>` when set. */
    token: getEnv('API_TOKEN'),
  },

  mobile: {
    appiumUrl: getEnv('APPIUM_URL', 'http://127.0.0.1:4723'),
    android: {
      deviceName: getEnv('ANDROID_DEVICE', 'emulator-5554'),
      platformVersion: getEnv('ANDROID_VERSION'),
      app: getEnv('ANDROID_APP'),
      appPackage: getEnv('ANDROID_APP_PACKAGE'),
      appActivity: getEnv('ANDROID_APP_ACTIVITY'),
    },
    ios: {
      deviceName: getEnv('IOS_DEVICE', 'iPhone 15'),
      platformVersion: getEnv('IOS_VERSION'),
      app: getEnv('IOS_APP'),
      bundleId: getEnv('IOS_BUNDLE_ID'),
    },
  },

  jira: {
    baseUrl: getEnv('JIRA_BASE_URL'),
  },

  /**
   * The build under test and where it belongs: BUILD_VERSION (e.g. "v0.2.0" or the CI build number), RELEASE,
   * SPRINT (e.g. "01"), set in the root/app .env or on the command line. Shown in every report and saved run,
   * so each result is tied to the build it tested.
   */
  build: {
    version: getEnv('BUILD_VERSION'),
    release: getEnv('RELEASE'),
    sprint: getEnv('SPRINT'),
    /** The test code's own commit (this repository). */
    commit: gitCommit(),
  },

  /** The QA running the tests (root .env QA_NAME / QA_EMAIL): "Tested by" and test owner in the report. */
  qa: {
    name: resolveQaName(),
    email: getEnv('QA_EMAIL'),
  },

  run: {
    /** Running on a CI server (CI is set by GitHub Actions, Azure DevOps, Jenkins, GitLab). */
    ci: getEnv('CI') !== '' && getEnv('CI') !== 'false',
    /** RETRIES=<n> overrides the default (2 in CI, 0 locally). A test that passes on a retry is reported as flaky. */
    retries: getEnv('RETRIES') === '' ? undefined : numberSetting('RETRIES', 0),
  },

  /** Test mailbox read by the `mailbox` fixture (signup / OTP / reset-password emails). Defaults: Gmail. */
  mail: {
    /** The mailbox login, e.g. qa.mysite@gmail.com. Test addresses are made from it: qa.mysite+<tag>@gmail.com */
    user: getEnv('MAIL_USER'),
    /** Gmail/Outlook: an app password (needs 2-step verification), not the normal password. */
    password: getEnv('MAIL_PASSWORD'),
    imapHost: getEnv('MAIL_IMAP_HOST', 'imap.gmail.com'),
    imapPort: numberSetting('MAIL_IMAP_PORT', 993),
    /** Seconds to wait for an email before failing. */
    waitSeconds: numberSetting('MAIL_WAIT_SECONDS', 60),
  },

  testData: {
    /** Start of every name created by testDataName(), so leftover test data is easy to find and delete. */
    prefix: getEnv('TEST_DATA_PREFIX', 'qa-auto'),
  },

  /** Every run's report is kept in reports/<app>/ (see src/report/archive.ts). */
  /**
   * After every saved run, a short summary is posted to this Teams / Slack incoming webhook (optional).
   * REPORT_URL: where people find the report (CI sets it to the pipeline run); default: the local path.
   */
  notify: {
    webhook: getEnv('NOTIFY_WEBHOOK'),
    reportUrl: getEnv('REPORT_URL'),
  },

  reportArchive: {
    enabled: getEnv('REPORT_ARCHIVE', 'on') !== 'off',
    /** Delete archived runs older than this many days; 0 = keep forever. */
    keepDays: numberSetting('REPORT_KEEP_DAYS', 30),
    /** Keep at most this many runs per app (newest first); 0 = no limit. */
    keepRuns: numberSetting('REPORT_KEEP_RUNS', 50),
    /**
     * What a saved run keeps of failed tests next to report.html (evidence/): video (default), trace (video and
     * Playwright trace: records typed passwords and session cookies, keep inside the QA team) or none.
     */
    evidence: (['video', 'trace', 'none'].includes(getEnv('REPORT_EVIDENCE')) ? getEnv('REPORT_EVIDENCE') : 'video') as
      | 'video'
      | 'trace'
      | 'none',
  },
} as const;
