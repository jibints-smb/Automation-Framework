/**
 * Environment settings: the only place that reads `process.env`.
 *
 * Which application is tested comes from `APP` (root `.env` or the command line):
 *   APP=saucedemo npm test
 * Settings are then loaded, first value wins:
 *   1. real environment variables (CI secrets)
 *   2. apps/<APP>/.env.<TEST_ENV>   e.g. .env.staging
 *   3. apps/<APP>/.env
 *   4. root .env                     shared settings such as JIRA_BASE_URL
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export const ROOT_DIR = path.resolve(__dirname, '../..');
const APPS_DIR = path.join(ROOT_DIR, 'apps');

dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

function listApps(): string[] {
  return fs.existsSync(APPS_DIR)
    ? fs.readdirSync(APPS_DIR).filter((name) => fs.existsSync(path.join(APPS_DIR, name, 'app.config.ts')))
    : [];
}

function resolveApp(): string {
  const apps = listApps();
  const app = process.env.APP ?? (apps.length === 1 ? apps[0] : undefined);
  if (!app || !apps.includes(app)) {
    throw new Error(
      `${app ? `Unknown APP "${app}"` : 'APP is not set'}. Set APP in the root .env or run e.g. "APP=${apps[0] ?? 'my-app'} npm test". ` +
        `Available apps: ${apps.join(', ') || 'none (create one with npm run new:app <name>)'}`,
    );
  }
  return app;
}

const appName = resolveApp();
const testEnv = process.env.TEST_ENV ?? 'qa';
export const APP_DIR = path.join(APPS_DIR, appName);

dotenv.config({ path: [path.join(APP_DIR, `.env.${testEnv}`), path.join(APP_DIR, '.env')], quiet: true });

/** Read any setting (empty string when not set). Use for app-specific variables. */
export function getEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

/** Read a setting that must be present; fails with a clear message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing setting ${name} in apps/${appName}/.env.${testEnv} or apps/${appName}/.env`);
  return value;
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

  run: {
    /** RETRIES=<n> overrides the default (2 in CI, 0 locally). A test that passes on a retry is reported as flaky. */
    retries: getEnv('RETRIES') === '' ? undefined : Number(getEnv('RETRIES')),
  },

  /** Test mailbox read by the `mailbox` fixture (signup / OTP / reset-password emails). Defaults: Gmail. */
  mail: {
    /** The mailbox login, e.g. qa.mysite@gmail.com. Test addresses are made from it: qa.mysite+<tag>@gmail.com */
    user: getEnv('MAIL_USER'),
    /** Gmail/Outlook: an app password (needs 2-step verification), not the normal password. */
    password: getEnv('MAIL_PASSWORD'),
    imapHost: getEnv('MAIL_IMAP_HOST', 'imap.gmail.com'),
    imapPort: Number(getEnv('MAIL_IMAP_PORT', '993')),
    /** Seconds to wait for an email before failing. */
    waitSeconds: Number(getEnv('MAIL_WAIT_SECONDS', '60')),
  },

  testData: {
    /** Start of every name created by testDataName(), so leftover test data is easy to find and delete. */
    prefix: getEnv('TEST_DATA_PREFIX', 'qa-auto'),
  },

  /** Every run's report is kept in reports/<app>/ (see src/report/archive.ts). */
  reportArchive: {
    enabled: getEnv('REPORT_ARCHIVE', 'on') !== 'off',
    /** Delete archived runs older than this many days; 0 = keep forever. */
    keepDays: Number(getEnv('REPORT_KEEP_DAYS', '0')) || 0,
  },
} as const;
