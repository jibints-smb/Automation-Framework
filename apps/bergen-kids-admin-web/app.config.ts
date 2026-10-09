/**
 * Bergen Kids Admin (web admin panel): application settings. Per-environment values (URLs, accounts, app builds) go in .env.
 */
import { defineApp } from '@core/config/app';
import { DashboardPage } from '@apps/bergen-kids-admin-web/pages/DashboardPage';
import { LoginPage } from '@apps/bergen-kids-admin-web/pages/LoginPage';

export default defineApp({
  name: 'Bergen Kids Admin',
  platforms: ["web"],

  web: {
    baseUrl: 'https://stagingadminbergenkids.newagesmb.com', // staging (BASE_URL in .env overrides it)
    testIdAttribute: 'data-testid', // the app has no test IDs yet (locators by role / label / #id)
  },

  // Defaults for verify.accessible() / verify.performance() / verify.looksLike()
  checks: {
    accessibility: { failOn: 'serious' }, // WCAG 2.1 AA; ignore only ticketed issues
    performance: { fcp: 2500, load: 4000, kb: 2048 }, // ms / KB, per page load (TC-LOGIN-30)
  },

  auth: {
    defaultRole: 'superadmin',
    roles: {
      superadmin: { usernameEnv: 'SUPERADMIN_EMAIL', passwordEnv: 'SUPERADMIN_PASSWORD' },
    },
    login: async (page, credentials) => {
      const loginPage = new LoginPage(page);
      await loginPage.open();
      await loginPage.login({ email: credentials.username, password: credentials.password });
      await new DashboardPage(page).expectLoaded();
    },
    loginUrl: /\/auth\/login/, // a logged-in test that ends here is reported as "session lost"
  },
});
