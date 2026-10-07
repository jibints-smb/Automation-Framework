/**
 * The `test` every SauceDemo spec imports: core fixtures (role, api, cleanup, driver)
 * plus this app's pages and screens.
 *
 *   import { test, expect } from '@apps/saucedemo/fixtures';
 */
import { test as core } from '@core/fixtures';
import { InventoryPage } from '@apps/saucedemo/pages/InventoryPage';
import { LoginPage } from '@apps/saucedemo/pages/LoginPage';
import { HomeScreen } from '@apps/saucedemo/screens/HomeScreen';
import { LoginScreen } from '@apps/saucedemo/screens/LoginScreen';

/** Register every page and screen of this app here so tests can ask for it by name. */
type AppFixtures = {
  // web pages
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  // mobile screens
  loginScreen: LoginScreen;
  homeScreen: HomeScreen;
};

export const test = core.extend<AppFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  inventoryPage: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },
  loginScreen: async ({ driver, platform }, use) => {
    await use(new LoginScreen(driver, platform));
  },
  homeScreen: async ({ driver, platform }, use) => {
    await use(new HomeScreen(driver, platform));
  },
});

export { expect } from '@core/fixtures';
