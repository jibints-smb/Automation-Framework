/**
 * SauceDemo (https://www.saucedemo.com): sample application showing how an app plugs into the framework.
 * Per-environment values (URLs, accounts, app builds) live in apps/saucedemo/.env.
 */
import { defineApp } from '@core/config/app';
import { InventoryPage } from '@apps/saucedemo/pages/InventoryPage';
import { LoginPage } from '@apps/saucedemo/pages/LoginPage';

export default defineApp({
  name: 'SauceDemo',
  platforms: ['web', 'mobile-web', 'android', 'ios', 'api'],

  web: {
    baseUrl: 'https://www.saucedemo.com',
    testIdAttribute: 'data-test',
  },

  checks: {
    accessibility: { failOn: 'serious' },
    performance: { fcp: 2500, load: 4000, kb: 2048 },
  },

  auth: {
    defaultRole: 'customer',
    roles: {
      customer: { usernameEnv: 'WEB_USERNAME', passwordEnv: 'WEB_PASSWORD' },
      problemUser: { usernameEnv: 'PROBLEM_USERNAME', passwordEnv: 'WEB_PASSWORD' },
    },
    login: async (page, credentials) => {
      const loginPage = new LoginPage(page);
      await loginPage.open();
      await loginPage.login(credentials);
      await new InventoryPage(page).expectLoaded();
    },
  },
});
