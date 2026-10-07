/**
 * Story:      SCRUM-101 — User can log in       (requirements/web/SCRUM-101-login.md)
 * Test cases: test-cases/web/login.testcases.md
 */
import { test } from '@apps/saucedemo/fixtures';
import { invalidLoginCases, validUser } from '@apps/saucedemo/data/web/login.data';
import { storyInfo } from '@core/utils/allure';

test.use({ role: null }); // login tests start logged out

test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await storyInfo({
      epic: 'Authentication',
      feature: 'Login',
      story: 'SCRUM-101 User can log in',
      jira: 'SCRUM-101',
      severity: 'critical',
    });
    await loginPage.open();
  });

  test('TC-LOGIN-01 | Valid user is taken to the Products page', { tag: ['@smoke', '@TC-LOGIN-01'] }, async ({ loginPage, inventoryPage }) => {
    await loginPage.login(validUser);
    await inventoryPage.expectLoaded();
  });

  for (const tc of invalidLoginCases) {
    test(`${tc.id} | ${tc.title}`, { tag: ['@regression', `@${tc.id}`] }, async ({ loginPage }) => {
      await loginPage.login(tc.data);
      await loginPage.expectError(tc.error);
    });
  }
});
