/**
 * The `test` every Bergen Kids Admin Web spec imports: core fixtures (role, api, cleanup, driver)
 * plus this app's pages and screens.
 *
 *   import { test, expect } from '@apps/bergen-kids-admin-web/fixtures';
 */
import { test as core } from '@core/fixtures';
import { AdvertiserAccountsPage } from '@apps/bergen-kids-admin-web/pages/AdvertiserAccountsPage';
import { CodeVerificationPage } from '@apps/bergen-kids-admin-web/pages/CodeVerificationPage';
import { DashboardPage } from '@apps/bergen-kids-admin-web/pages/DashboardPage';
import { ForgotPasswordPage } from '@apps/bergen-kids-admin-web/pages/ForgotPasswordPage';
import { LoginPage } from '@apps/bergen-kids-admin-web/pages/LoginPage';
import { SetPasswordPage } from '@apps/bergen-kids-admin-web/pages/SetPasswordPage';

/** Register every page and screen of this app here so tests can ask for it by name. */
type AppFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  forgotPasswordPage: ForgotPasswordPage;
  codeVerificationPage: CodeVerificationPage;
  setPasswordPage: SetPasswordPage;
  advertiserAccountsPage: AdvertiserAccountsPage;
};

export const test = core.extend<AppFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  forgotPasswordPage: async ({ page }, use) => {
    await use(new ForgotPasswordPage(page));
  },
  codeVerificationPage: async ({ page }, use) => {
    await use(new CodeVerificationPage(page));
  },
  setPasswordPage: async ({ page }, use) => {
    await use(new SetPasswordPage(page));
  },
  advertiserAccountsPage: async ({ page }, use) => {
    await use(new AdvertiserAccountsPage(page));
  },
});

export { expect } from '@core/fixtures';
