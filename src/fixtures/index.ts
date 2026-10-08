/**
 * Core `test`: what every app gets for free. Each app extends it with its own pages/screens
 * in apps/<name>/fixtures.ts, and specs import `test` from there.
 *
 * Options (set with `test.use({...})` or per project):
 *   role        which logged-in user the browser / native app starts as (null = logged out)
 *   freshLogin  log in for this test only instead of reusing the saved session: for tests that log out on the
 *               server, change the password or end other sessions (they would break the shared session)
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
import fs from 'node:fs';
import path from 'node:path';
import { app, credentialsFor, settings } from '@core/config/app';
import { ROOT_DIR, env } from '@core/config/env';
import { authFile } from '@core/config/paths';
import { getCapabilities, type Platform } from '@core/mobile/capabilities';
import { Mailbox } from '@core/mail/Mailbox';
import { createDriver, type MobileDriver } from '@core/mobile/driver';
import { finishTestReport, startTestReport } from '@core/report/report';
import { runLog } from '@core/report/runLog';
import { Cleanup } from '@core/utils/cleanup';
import { redact } from '@core/utils/redact';
import { step } from '@core/utils/step';

const MAX_LOG_LINES = 30;
/** Requests cancelled by navigation are normal, not failures. */
const IGNORED_REQUEST_ERRORS = /ERR_ABORTED|NS_BINDING_ABORTED|cancelled|aborted/i;

export type CoreOptions = {
  role: string | null;
  freshLogin: boolean;
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
  freshLogin: [false, { option: true }],
  platform: ['android', { option: true }],

  /** Start the browser logged in as `role`, using the session saved by the auth setup. */
  storageState: async ({ role, freshLogin, storageState, browser }, use) => {
    if (role && !app.auth?.roles[role]) {
      throw new Error(`Unknown role "${role}". Roles in app.config.ts: ${Object.keys(app.auth?.roles ?? {}).join(', ')}`);
    }
    if (!role || !app.auth?.login) return use(storageState);

    if (freshLogin) {
      // this test's own session: logging out or changing the password here can't break the other tests
      const context = await browser.newContext({ baseURL: settings.baseUrl });
      try {
        const page = await context.newPage();
        await step(`Log in as ${role} (own session)`, () => app.auth!.login!(page, credentialsFor(role)));
        return await use(await context.storageState({ indexedDB: true }));
      } finally {
        await context.close();
      }
    }

    const file = authFile(role);
    if (!fs.existsSync(file)) {
      throw new Error(
        `No saved login for role "${role}" (${path.relative(ROOT_DIR, file)}). Run the tests with their login setup ` +
          '(e.g. npm run test:web, not --no-deps), or save the logins first: npm run auth',
      );
    }
    await use(file);
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
    // tokens in URLs (reset links, ?code=) and secrets in console output are masked before they reach the report
    const add = (list: string[], line: string) => list.length < MAX_LOG_LINES && list.push(redact(line));

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
      url: page.isClosed() ? '' : redact(page.url()),
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

  // depends on api, so the api client is closed only after the cleanup that uses it has run
  cleanup: async ({ api: _api }, use) => {
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
    if (!capabilities) {
      const missing =
        platform === 'android'
          ? 'Android app not configured: set ANDROID_APP or ANDROID_APP_PACKAGE in the app .env'
          : 'iOS app not configured: set IOS_APP or IOS_BUNDLE_ID in the app .env';
      // locally a missing app just skips; in CI it is a forgotten secret and must not pass as a green build
      if (env.run.ci) throw new Error(`${missing} (or as a CI secret)`);
      testInfo.skip(true, missing);
    }

    runLog.device = [capabilities!.platformName, capabilities!['appium:platformVersion'], `· ${capabilities!['appium:deviceName']}`]
      .filter(Boolean)
      .join(' ');
    const driver = await createDriver(capabilities!);
    try {
      const mobileLogin = app.mobile?.login;
      if (role && mobileLogin) {
        await step(`Log in as ${role}`, () => mobileLogin({ driver, platform }, credentialsFor(role)));
      }
      await use(driver);
    } finally {
      // each step on its own: a crashed session must not hide the real error or leave the device locked
      if (testInfo.status !== testInfo.expectedStatus) {
        await driver
          .takeScreenshot()
          .then((png) => testInfo.attach('screenshot', { body: Buffer.from(png, 'base64'), contentType: 'image/png' }))
          .catch(() => undefined);
        await driver
          .getPageSource()
          .then((xml) => testInfo.attach('page-source', { body: xml, contentType: 'text/xml' }))
          .catch(() => undefined);
      }
      await driver.deleteSession().catch(() => undefined);
    }
  },
});

export { expect } from '@playwright/test';
