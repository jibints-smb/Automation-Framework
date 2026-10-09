/**
 * Logs in once per role of the active app and saves each session to .auth/<app>/<env>/<role>.json.
 * Runs automatically before the web projects; tests then start logged in (see `role` in fixtures).
 * The login steps themselves are defined by each app in app.config.ts (`auth.login`).
 */
import * as allure from 'allure-js-commons';
import { test as setup } from '@core/fixtures';
import { app, credentialsFor } from '@core/config/app';
import { env } from '@core/config/env';
import { authFile } from '@core/config/paths';
import { redact } from '@core/utils/redact';

setup.use({ role: null });

for (const role of Object.keys(app.auth?.roles ?? {})) {
  setup(`log in as ${role}`, async ({ page }) => {
    // grouped apart from the app's features, so a failed login is easy to spot as a setup problem
    await allure.epic('Test setup');
    await allure.feature('Log in each role');
    await allure.severity('blocker');
    try {
      await app.auth!.login!(page, credentialsFor(role));
    } catch (error) {
      // usually changed test credentials: say so, instead of only "dashboard not visible"
      const { usernameEnv, passwordEnv } = app.auth!.roles[role];
      const envFile = env.name === 'qa' ? `apps/${env.app}/.env` : `apps/${env.app}/.env.${env.name} (or .env)`;
      throw new Error(
        `Login as "${role}" failed at ${redact(page.url())}. The test credentials may have changed: check ` +
          `${usernameEnv} / ${passwordEnv} in ${envFile}, then run npm run auth.\n` +
          `Cause: ${redact(error instanceof Error ? error.message : String(error))}`,
      );
    }
    // indexedDB: apps that keep their token there (Firebase and similar) stay logged in too
    await page.context().storageState({ path: authFile(role), indexedDB: true });
  });
}
