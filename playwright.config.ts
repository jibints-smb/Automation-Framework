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
import { defineConfig, devices, type PlaywrightTestOptions, type PlaywrightWorkerOptions, type Project } from '@playwright/test';
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

const projects: Project<CoreOptions & PlaywrightTestOptions, PlaywrightWorkerOptions>[] = [];
if (needsLogin && (app.platforms.includes('web') || app.platforms.includes('mobile-web'))) {
  // no trace / video / screenshot: they would record the account passwords typed during login
  projects.push({
    name: 'setup',
    testDir: './src/auth',
    testMatch: /auth\.setup\.ts/,
    use: { ...devices['Desktop Chrome'], trace: 'off', video: 'off', screenshot: 'off' },
  });
}
const desktop = {
  chrome: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  safari: devices['Desktop Safari'],
  edge: { ...devices['Desktop Edge'], channel: 'msedge' },
};
if (app.platforms.includes('web')) {
  for (const browser of app.web?.browsers ?? ['chrome']) {
    projects.push({ name: `web-${browser}`, ...webProject, use: { ...desktop[browser] } });
  }
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
  forbidOnly: env.run.ci,
  retries: env.run.retries ?? (env.run.ci ? 2 : 0),
  workers: env.run.ci ? 2 : undefined,
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
          'Tested by': env.qa.email ? `${env.qa.name} <${env.qa.email}>` : env.qa.name,
          // only the ones that are set (BUILD_VERSION / RELEASE / SPRINT, git commit of the test code)
          ...(env.build.version ? { Build: env.build.version } : {}),
          ...(env.build.release ? { Release: env.build.release } : {}),
          ...(env.build.sprint ? { Sprint: env.build.sprint } : {}),
          ...(env.build.commit ? { 'Test code commit': env.build.commit } : {}),
          'Base URL': settings.baseUrl,
          'Node.js': process.version,
          OS: process.platform,
        },
      },
    ],
    // CI dashboards (GitHub Actions, Azure DevOps, Jenkins) read JUnit XML
    ...(env.run.ci ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
    // must stay last: saves this run's report to reports/<app>/ after Allure has written its results
    ['./src/report/archive.ts'],
  ],

  use: {
    baseURL: settings.baseUrl,
    testIdAttribute: settings.testIdAttribute,
    // app.config.ts web: same language / time zone everywhere, self-signed QA certificates
    ...(app.web?.locale ? { locale: app.web.locale } : {}),
    ...(app.web?.timezoneId ? { timezoneId: app.web.timezoneId } : {}),
    ...(app.web?.ignoreHTTPSErrors ? { ignoreHTTPSErrors: true } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },

  projects,
});
