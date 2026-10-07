/**
 * Story:      MOB-201 — User can log in to the mobile app   (requirements/mobile/MOB-201-login.md)
 * Test cases: test-cases/mobile/login.testcases.md
 *
 * Runs on Android and iOS (projects `android-app` / `ios-app`).
 * Skipped automatically until the app is configured in .env.
 */
import { test } from '@apps/saucedemo/fixtures';
import { validMobileUser, wrongPasswordUser } from '@apps/saucedemo/data/mobile/login.data';
import { MobileLoginMessages } from '@apps/saucedemo/models/mobile/login.model';
import { storyInfo } from '@core/utils/allure';

test.describe('Mobile login', () => {
  test.beforeEach(async ({ loginScreen }) => {
    await storyInfo({
      epic: 'Authentication',
      feature: 'Mobile login',
      story: 'MOB-201 User can log in to the mobile app',
      jira: 'MOB-201',
      severity: 'critical',
    });
    await loginScreen.expectLoaded();
  });

  test('TC-MLOGIN-01 | Valid user reaches the home screen', { tag: ['@smoke', '@TC-MLOGIN-01'] }, async ({ loginScreen, homeScreen }) => {
    await loginScreen.login(validMobileUser);
    await homeScreen.expectLoaded();
  });

  test('TC-MLOGIN-02 | Wrong password shows an error', { tag: ['@regression', '@TC-MLOGIN-02'] }, async ({ loginScreen }) => {
    await loginScreen.login(wrongPasswordUser);
    await loginScreen.expectError(MobileLoginMessages.invalidCredentials);
  });
});
