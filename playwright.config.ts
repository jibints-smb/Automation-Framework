/**
 * One config for every app. The active app (APP setting) decides the base URL, test-id attribute,
 * login roles and which projects exist (from `platforms` in apps/<app>/app.config.ts):
 *
 *   web          web-chrome           desktop Chrome                       → apps/<app>/tests/web
 *   mobile-web   mobile-web-android   responsive web on Pixel 7 (Chromium) → apps/<app>/tests/web
 *                mobile-web-ios       responsive web on iPhone 15 (WebKit) → apps/<app>/tests/web
 *   android      android-app          native Android app via Appium        → apps/<app>/tests/mobile
 *   ios          ios-app              native iOS app via Appium            → apps/<app>/tests/mobile
 *   api          api                  HTTP only, no browser or device      → apps/<app>/tests/api
 *
 * Approved screenshots for verify.looksLike() live in apps/<app>/screenshots/<project>-<os>/.
 */
import path from 'node:path';
import { defineConfig, devices, type Project } from '@playwright/test';
import { app, settings } from './src/config/app';
import { APP_DIR, env } from './src/config/env';
import type { CoreOptions } from './src/fixtures';

const webTests = path.join(APP_DIR, 'tests/web');
const mobileTests = path.join(APP_DIR, 'tests/mobile');
const apiTests = path.join(APP_DIR, 'tests/api');
const needsLogin = !!app.auth?.login;
const webProject = { testDir: webTests, dependencies: needsLogin ? ['setup'] : [] };
// @demo tests (practice examples) only run when asked for: npm run demo:email
const runDemos = process.argv.some((arg) => arg.includes('@demo'));
const nativeProject = { testDir: mobileTests, fullyParallel: false, workers: 1, timeout: 120_000 };

const projects: Project<CoreOptions>[] = [];
if (needsLogin && (app.platforms.includes('web') || app.platforms.includes('mobile-web'))) {
  projects.push({ name: 'setup', testDir: './src/auth', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'] } });
}
if (app.platforms.includes('web')) {
  projects.push({ name: 'web-chrome', ...webProject, use: { ...devices['Desktop Chrome'] } });
}
if (app.platforms.includes('mobile-web')) {
  projects.push({ name: 'mobile-web-android', ...webProject, use: { ...devices['Pixel 7'] } });
  projects.push({ name: 'mobile-web-ios', ...webProject, use: { ...devices['iPhone 15'] } });
}
if (app.platforms.includes('android')) {
  projects.push({ name: 'android-app', ...nativeProject, use: { platform: 'android' } });
}
if (app.platforms.includes('ios')) {
  projects.push({ name: 'ios-app', ...nativeProject, use: { platform: 'ios' } });
}
if (app.platforms.includes('api')) {
  projects.push({ name: 'api', testDir: apiTests, use: { role: null } });
}

export default defineConfig<CoreOptions>({
  globalSetup: './src/config/global-setup.ts',
  fullyParallel: true,
  grepInvert: runDemos ? undefined : /@demo/,
  forbidOnly: !!process.env.CI,
  retries: env.run.retries ?? (process.env.CI ? 2 : 0),
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: app.checks?.visualMaxDiffRatio ?? 0.01, animations: 'disabled', caret: 'hide' },
  },
  // per project and OS: fonts render differently on Windows, macOS and Linux (CI)
  snapshotPathTemplate: path.join(APP_DIR, 'screenshots', '{projectName}-{platform}', '{testFilePath}', '{arg}{ext}'),

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    [
      'allure-playwright',
      {
        resultsDir: 'allure-results',
        // false = report shows only our readable steps (and doesn't leak masked passwords
        // through Playwright's internal "Fill ..." steps)
        detail: false,
        suiteTitle: false,
        environmentInfo: {
          Application: app.name,
          Environment: env.name,
          'Base URL': settings.baseUrl,
          'Node.js': process.version,
          OS: process.platform,
        },
      },
    ],
    // must stay last: saves this run's report to reports/<app>/ after Allure has written its results
    ['./src/report/archive.ts'],
  ],

  use: {
    baseURL: settings.baseUrl,
    testIdAttribute: settings.testIdAttribute,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },

  projects,
});
