/**
 * Story:      BK-1 — Super Admin login       (requirements/web/BK-1-login.md)
 * Test cases: test-cases/web/login.testcases.md
 *
 * Cases marked (D1)/(D2)/(D3) expect the Jira story; the v0.2.0 build differs: pendingDecision() until the PO decides
 * (sprints/sprint-01.md → "Differences found"). Not automated: TC-LOGIN-23/24/25/31/32 (later), TC-LOGIN-26 (manual).
 */
import { test } from '@apps/bergen-kids-admin-web/fixtures';
import {
  emptyFieldCases,
  invalidEmails,
  superAdmin,
  unknownEmail,
  wrongPassword,
} from '@apps/bergen-kids-admin-web/data/web/login.data';
import { LoginFields, LoginMessages } from '@apps/bergen-kids-admin-web/models/web/login.model';
import { pendingDecision, storyInfo } from '@core/utils/allure';

test.beforeEach(async () => {
  await storyInfo({
    epic: 'Authentication',
    feature: 'Login',
    story: 'BK-1 Super Admin login',
    jira: 'BK-1',
    severity: 'critical',
  });
});

test.describe('Login', () => {
  test.use({ role: null }); // a new browser context per test: logged out, site data empty

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.open();
  });

  test('TC-LOGIN-01 | Login page shows all fields and controls', { tag: ['@regression', '@TC-LOGIN-01'] }, async ({ loginPage }) => {
    await loginPage.expectAllControls();
  });

  test('TC-LOGIN-02 | Valid login opens the dashboard', { tag: ['@smoke', '@regression', '@TC-LOGIN-02'] }, async ({ loginPage, dashboardPage }) => {
    await loginPage.login(superAdmin);
    await loginPage.expectWelcomeToast();
    await dashboardPage.expectLoaded();
  });

  test('TC-LOGIN-03 | Pressing Enter signs in', { tag: ['@regression', '@TC-LOGIN-03'] }, async ({ loginPage, dashboardPage }) => {
    await loginPage.loginWithEnter(superAdmin);
    await loginPage.expectWelcomeToast();
    await dashboardPage.expectLoaded();
  });

  for (const tc of emptyFieldCases) {
    test(`${tc.id} | ${tc.title}`, { tag: ['@regression', `@${tc.id}`] }, async ({ loginPage }) => {
      pendingDecision('D1', 'Build shows different validation texts than the story (e.g. "Enter your email address")');
      await loginPage.login(tc.data);
      await loginPage.expectFieldErrors(tc.errors);
      await loginPage.expectNotSignedIn();
    });
  }

  test('TC-LOGIN-05 | Invalid email format is rejected', { tag: ['@regression', '@TC-LOGIN-05'] }, async ({ loginPage }) => {
    pendingDecision('D1', 'Build shows different validation texts than the story (e.g. "Enter your email address")');
    for (const email of invalidEmails) {
      await loginPage.login({ email, password: wrongPassword() });
      await loginPage.expectFieldErrors({ email: LoginFields.email.rules.messages.pattern });
      await loginPage.expectNotSignedIn();
    }
  });

  test('TC-LOGIN-08 | Wrong password is rejected', { tag: ['@regression', '@TC-LOGIN-08'] }, async ({ loginPage }) => {
    await loginPage.login({ email: superAdmin.email, password: wrongPassword() });
    await loginPage.expectToast(LoginMessages.invalidCredentials);
    await loginPage.expectNotSignedIn();
  });

  test('TC-LOGIN-09 | Unknown email is rejected', { tag: ['@regression', '@TC-LOGIN-09'] }, async ({ loginPage }) => {
    await loginPage.login({ email: unknownEmail(), password: wrongPassword() });
    await loginPage.expectToast(LoginMessages.invalidCredentials);
    await loginPage.expectNotSignedIn();
  });

  test('TC-LOGIN-10 | Fields stay filled after a failed login', { tag: ['@regression', '@TC-LOGIN-10'] }, async ({ loginPage }) => {
    const attempt = { email: superAdmin.email, password: wrongPassword() };
    await loginPage.login(attempt);
    await loginPage.expectToast(LoginMessages.invalidCredentials);
    await loginPage.expectFilledWith(attempt);
  });

  test('TC-LOGIN-11 | Spaces around the email are trimmed', { tag: ['@regression', '@TC-LOGIN-11'] }, async ({ loginPage, dashboardPage }) => {
    await loginPage.login({ email: `  ${superAdmin.email}  `, password: superAdmin.password });
    await dashboardPage.expectLoaded();
  });

  test('TC-LOGIN-12 | Email is not case-sensitive', { tag: ['@regression', '@TC-LOGIN-12'] }, async ({ loginPage, dashboardPage }) => {
    await loginPage.login({ email: superAdmin.email.toUpperCase(), password: superAdmin.password });
    await dashboardPage.expectLoaded();
  });

  test('TC-LOGIN-13 | Password is masked by default', { tag: ['@regression', '@TC-LOGIN-13'] }, async ({ loginPage }) => {
    await loginPage.act.fill(loginPage.fields.password, wrongPassword());
    await loginPage.expectPasswordMasked();
  });

  test('TC-LOGIN-14 | Show/Hide toggles the password without clearing it', { tag: ['@regression', '@TC-LOGIN-14'] }, async ({ loginPage }) => {
    const password = wrongPassword();
    await loginPage.act.fill(loginPage.fields.password, password);
    await loginPage.showPassword();
    await loginPage.expectPasswordMasked(false);
    await loginPage.verify.value(loginPage.fields.password, password);
    await loginPage.hidePassword();
    await loginPage.expectPasswordMasked();
    await loginPage.verify.value(loginPage.fields.password, password);
  });

  test('TC-LOGIN-15 | "Keep me signed in" is checked by default', { tag: ['@regression', '@TC-LOGIN-15'] }, async ({ loginPage }) => {
    pendingDecision('D2', 'Build leaves "Keep me signed in" unticked; story says checked by default');
    // fresh context = site data cleared
    await loginPage.expectKeepSignedIn(true);
  });

  test('TC-LOGIN-16 | Ticked: login is remembered after logout', { tag: ['@regression', '@TC-LOGIN-16'] }, async ({ loginPage, dashboardPage }) => {
    await loginPage.login({ ...superAdmin, keepSignedIn: true });
    await dashboardPage.expectLoaded();
    await dashboardPage.signOut();
    await loginPage.open();
    await loginPage.expectFilledWith(superAdmin);
    await loginPage.expectRememberedLogin();
  });

  test('TC-LOGIN-17 | Remembered login is gone after clearing site data', { tag: ['@regression', '@TC-LOGIN-17'] }, async ({ loginPage, dashboardPage }) => {
    await loginPage.login({ ...superAdmin, keepSignedIn: true });
    await dashboardPage.expectLoaded();
    await dashboardPage.signOut();
    await loginPage.expectRememberedLogin();
    await loginPage.clearSiteData();
    await loginPage.open();
    await loginPage.expectEmpty();
  });

  test('TC-LOGIN-18 | Unticked: login is not saved and an earlier saved login is kept', { tag: ['@regression', '@TC-LOGIN-18'] }, async ({ loginPage, dashboardPage }) => {
    pendingDecision('D3', 'Build deletes the saved login when "Keep me signed in" is unticked');
    await loginPage.login({ ...superAdmin, keepSignedIn: true });
    await dashboardPage.expectLoaded();
    await dashboardPage.signOut();
    await loginPage.login({ ...superAdmin, keepSignedIn: false });
    await dashboardPage.expectLoaded();
    await dashboardPage.signOut();
    await loginPage.open();
    // (D3) the build deletes the saved login when unticked
    await loginPage.expectRememberedLogin();
    await loginPage.expectFilledWith(superAdmin);
  });

  test('TC-LOGIN-19 | "Forgot?" opens forgot password', { tag: ['@regression', '@TC-LOGIN-19'] }, async ({ loginPage, forgotPasswordPage }) => {
    await loginPage.openForgotPassword();
    await forgotPasswordPage.expectLoaded();
  });

  test('TC-LOGIN-22 | Logout ends the session', { tag: ['@regression', '@TC-LOGIN-22'] }, async ({ loginPage, dashboardPage }) => {
    // signs in itself: logging out of the shared saved session would sign out the other tests
    await loginPage.login(superAdmin);
    await dashboardPage.expectLoaded();
    await dashboardPage.signOut();
    await loginPage.expectLoaded();
    await dashboardPage.open();
    await loginPage.expectLoaded();
  });

  test('TC-LOGIN-27 | Theme toggle switches light / dark', { tag: ['@regression', '@TC-LOGIN-27'] }, async ({ loginPage }) => {
    await loginPage.expectTheme('light');
    await loginPage.toggleTheme();
    await loginPage.expectTheme('dark');
    await loginPage.toggleTheme();
    await loginPage.expectTheme('light');
  });

  test('TC-LOGIN-28 | Login page is accessible', { tag: ['@regression', '@a11y', '@TC-LOGIN-28'] }, async ({ loginPage }) => {
    await loginPage.verify.accessible();
  });

  test('TC-LOGIN-29 | Login page looks as approved', { tag: ['@regression', '@visual', '@TC-LOGIN-29'] }, async ({ loginPage }) => {
    await loginPage.expectTheme('light');
    await loginPage.verify.looksLike('login', { mask: [loginPage.fields.footer, loginPage.fields.heroPanel] });
  });
});

test.describe('Login (first page load)', () => {
  test.use({ role: null }); // these open their own page, so the first load is measured / redirected

  test('TC-LOGIN-20 | Protected page while signed out returns there after login', { tag: ['@regression', '@TC-LOGIN-20'] }, async ({ loginPage }) => {
    // /parents rather than /: the dashboard is also where a login without callbackUrl lands
    await loginPage.act.goto('/parents');
    await loginPage.verify.url(/\/auth\/login\?callbackUrl=.*%2Fparents$/);
    await loginPage.login(superAdmin);
    await loginPage.verify.url(/^https?:\/\/[^/]+\/parents$/);
  });

  test('TC-LOGIN-30 | Login page loads fast', { tag: ['@regression', '@perf', '@TC-LOGIN-30'] }, async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.verify.performance();
  });
});

test.describe('Login while signed in', () => {
  // default role: the saved Super Admin session

  test('TC-LOGIN-21 | Signed-in admin can\'t open the login page', { tag: ['@regression', '@TC-LOGIN-21'] }, async ({ loginPage, dashboardPage }) => {
    await loginPage.open();
    await dashboardPage.expectLoaded();
  });
});
