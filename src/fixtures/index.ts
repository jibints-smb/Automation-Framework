/**
 * Core `test`: what every app gets for free. Each app extends it with its own pages/screens
 * in apps/<name>/fixtures.ts, and specs import `test` from there.
 *
 * Options (set with `test.use({...})` or per project):
 *   role      which logged-in user the browser / native app starts as (null = logged out)
 *   platform  'android' | 'ios' for native app projects
 *
 * Fixtures:
 *   api       REST client for setup/cleanup/API checks
 *   cleanup   register cleanup work that runs after the test, even on failure
 *   driver    Appium session for native app tests
 *   mailbox   test email inbox: unique addresses, wait for an email, read its OTP / link (src/mail)
 *   report    (automatic) test case, severity and failure bug report in Allure; see src/report/report.ts
 */
import { test as base } from '@playwright/test';
import { ApiClient } from '@core/api/ApiClient';
import { app, settings } from '@core/config/app';
import { requireEnv } from '@core/config/env';
import { authFile } from '@core/config/paths';
import { getCapabilities, type Platform } from '@core/mobile/capabilities';
import { Mailbox } from '@core/mail/Mailbox';
import { createDriver, type MobileDriver } from '@core/mobile/driver';
import { finishTestReport, startTestReport } from '@core/report/report';
import { runLog } from '@core/report/runLog';
import { Cleanup } from '@core/utils/cleanup';
import { step } from '@core/utils/step';

const MAX_LOG_LINES = 30;
/** Requests cancelled by navigation are normal, not failures. */
const IGNORED_REQUEST_ERRORS = /ERR_ABORTED|NS_BINDING_ABORTED|cancelled|aborted/i;

export type CoreOptions = {
  role: string | null;
  platform: Platform;
};

type CoreFixtures = {
  api: ApiClient;
  cleanup: Cleanup;
  driver: MobileDriver;
  mailbox: Mailbox;
  report: void;
};

export const test = base.extend<CoreOptions & CoreFixtures>({
  role: [app.auth?.defaultRole ?? null, { option: true }],
  platform: ['android', { option: true }],

  /** Start the browser logged in as `role`, using the session saved by the auth setup. */
  storageState: async ({ role, storageState }, use) => {
    if (role && !app.auth?.roles[role]) {
      throw new Error(`Unknown role "${role}". Roles in app.config.ts: ${Object.keys(app.auth?.roles ?? {}).join(', ')}`);
    }
    await use(role && app.auth?.login ? authFile(role) : storageState);
  },

  /** Runs for every test: set up first, finished last, so it sees the final status and all diagnostics. */
  report: [
    async ({ role }, use, testInfo) => {
      const testCase = await startTestReport(testInfo, role);
      await use();
      await finishTestReport(testInfo, testCase, role);
    },
    { auto: true },
  ],

  /** Collects browser console errors and failed requests, so a bug report shows what the app logged. */
  page: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const add = (list: string[], line: string) => list.length < MAX_LOG_LINES && list.push(line);

    page.on('console', (msg) => msg.type() === 'error' && add(consoleErrors, msg.text()));
    page.on('pageerror', (err) => add(consoleErrors, `Uncaught ${err.name}: ${err.message}`));
    page.on('response', (res) => res.status() >= 400 && add(failedRequests, `${res.status()} ${res.request().method()} ${res.url()}`));
    page.on('requestfailed', (req) => {
      const reason = req.failure()?.errorText ?? '';
      if (!IGNORED_REQUEST_ERRORS.test(reason)) add(failedRequests, `${reason} ${req.method()} ${req.url()}`);
    });

    await use(page);

    const browser = page.context().browser();
    runLog.web = {
      url: page.isClosed() ? '' : page.url(),
      browser: browser ? `${browser.browserType().name()} ${browser.version()}` : '',
      consoleErrors,
      failedRequests,
    };
  },

  api: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({
      baseURL: settings.apiBaseUrl,
      extraHTTPHeaders: settings.apiHeaders,
    });
    await use(new ApiClient(request));
    await request.dispose();
  },

  /** Connects only when a test first reads email; afterwards moves that test's emails to Trash. */
  mailbox: async ({}, use) => {
    const mailbox = new Mailbox();
    await use(mailbox);
    await mailbox.close();
  },

  cleanup: async ({}, use) => {
    const cleanup = new Cleanup();
    await use(cleanup);
    await cleanup.runAll();
  },

  /**
   * One Appium session per test, logged in as `role` when the app has `mobile.login`.
   * Screenshot + page source are attached to the report on failure.
   */
  driver: async ({ platform, role }, use, testInfo) => {
    const capabilities = getCapabilities(platform);
    testInfo.skip(
      !capabilities,
      platform === 'android'
        ? 'Android app not configured: set ANDROID_APP or ANDROID_APP_PACKAGE in the app .env'
        : 'iOS app not configured: set IOS_APP or IOS_BUNDLE_ID in the app .env',
    );

    runLog.device = [capabilities!.platformName, capabilities!['appium:platformVersion'], `· ${capabilities!['appium:deviceName']}`]
      .filter(Boolean)
      .join(' ');
    const driver = await createDriver(capabilities!);
    try {
      const mobileLogin = app.mobile?.login;
      if (role && mobileLogin) {
        const account = app.auth?.roles[role];
        if (!account) throw new Error(`Unknown role "${role}". Roles in app.config.ts: ${Object.keys(app.auth?.roles ?? {}).join(', ')}`);
        const credentials = { username: requireEnv(account.usernameEnv), password: requireEnv(account.passwordEnv) };
        await step(`Log in as ${role}`, () => mobileLogin({ driver, platform }, credentials));
      }
      await use(driver);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('screenshot', {
          body: Buffer.from(await driver.takeScreenshot(), 'base64'),
          contentType: 'image/png',
        });
        await testInfo.attach('page-source', { body: await driver.getPageSource(), contentType: 'text/xml' });
      }
      await driver.deleteSession();
    }
  },
});

export { expect } from '@playwright/test';
