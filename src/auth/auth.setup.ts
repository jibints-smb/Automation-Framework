/**
 * Logs in once per role of the active app and saves each session to .auth/<app>/<role>.json.
 * Runs automatically before the web projects; tests then start logged in (see `role` in fixtures).
 * The login steps themselves are defined by each app in app.config.ts (`auth.login`).
 */
import * as allure from 'allure-js-commons';
import { test as setup } from '@core/fixtures';
import { app } from '@core/config/app';
import { requireEnv } from '@core/config/env';
import { authFile } from '@core/config/paths';

setup.use({ role: null });

for (const [role, account] of Object.entries(app.auth?.roles ?? {})) {
  setup(`log in as ${role}`, async ({ page }) => {
    // grouped apart from the app's features, so a failed login is easy to spot as a setup problem
    await allure.epic('Test setup');
    await allure.feature('Log in each role');
    await allure.severity('blocker');
    const credentials = { username: requireEnv(account.usernameEnv), password: requireEnv(account.passwordEnv) };
    await app.auth!.login!(page, credentials);
    await page.context().storageState({ path: authFile(role) });
  });
}
