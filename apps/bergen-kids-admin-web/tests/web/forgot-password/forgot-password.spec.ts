/**
 * Story:      BK-2 — Super Admin forgot password   (requirements/web/BK-2-forgot-password.md)
 * Test cases: test-cases/web/forgot-password.testcases.md
 *
 * No test here completes a reset: the Super Admin is the only admin account and every other test logs in with it.
 * Cases marked (D7)–(D11) expect the Jira story; the v0.2.0 build differs: pendingDecision() until the PO decides
 * (sprints/sprint-01.md → "Differences found").
 * Not automated: TC-FP-07/08/17/18/21/22/35/36/37/43–46 (later), TC-FP-20/39 (manual).
 */
import { test } from '@apps/bergen-kids-admin-web/fixtures';
import { superAdmin } from '@apps/bergen-kids-admin-web/data/web/login.data';
import {
  adminEmail,
  checklistSteps,
  codeLength,
  eightCharacters,
  invalidEmails,
  missingRuleCases,
  nonDigitKeys,
  pastedWithLetter,
  sevenCharacters,
  shortCode,
  unknownEmail,
  validCode,
  validNewPassword,
  wrongCode,
} from '@apps/bergen-kids-admin-web/data/web/forgot-password.data';
import {
  ForgotPasswordApi,
  ForgotPasswordFields,
  ForgotPasswordMessages,
  PasswordRules,
  SetPasswordFields,
  type PasswordRule,
} from '@apps/bergen-kids-admin-web/models/web/forgot-password.model';
import type { CodeVerificationPage } from '@apps/bergen-kids-admin-web/pages/CodeVerificationPage';
import type { ForgotPasswordPage } from '@apps/bergen-kids-admin-web/pages/ForgotPasswordPage';
import { pendingDecision, storyInfo } from '@core/utils/allure';

// One worker, one test after another: every "send code" starts a new reset session for the only admin and ends the
// previous one, so tests running side by side would cancel each other's sessions (→ "session expired" → sign in).
test.describe.configure({ mode: 'default' });

const RESEND_WAIT_MS = 30_000;
const allRules = Object.keys(PasswordRules) as PasswordRule[];

/** Screen 1 → screen 2 for the Super Admin (sends a code; the password is not changed). */
async function reachCodeScreen(forgot: ForgotPasswordPage, code: CodeVerificationPage, beforeSend?: () => Promise<void>) {
  await forgot.open();
  await forgot.act.fill(forgot.fields.email, adminEmail());
  if (beforeSend) await beforeSend();
  await forgot.sendCode();
  await code.expectLoaded();
}

test.beforeEach(async () => {
  await storyInfo({
    epic: 'Authentication',
    feature: 'Forgot password',
    story: 'BK-2 Super Admin forgot password',
    jira: 'BK-2',
    severity: 'critical',
  });
});

test.describe('Forgot password: email screen', () => {
  test.use({ role: null });

  test('TC-FP-01 | Forgot password screen shows its fields and texts', { tag: ['@regression', '@TC-FP-01'] }, async ({ loginPage, forgotPasswordPage }) => {
    await loginPage.open();
    await loginPage.openForgotPassword();
    await forgotPasswordPage.expectLoaded();
    await forgotPasswordPage.expectAllControls();
  });

  test.describe(() => {
    test.beforeEach(async ({ forgotPasswordPage }) => {
      await forgotPasswordPage.open();
    });

    test('TC-FP-02 | Empty email is rejected', { tag: ['@regression', '@TC-FP-02'] }, async ({ forgotPasswordPage }) => {
      await forgotPasswordPage.sendCode();
      await forgotPasswordPage.expectEmailError(ForgotPasswordFields.email.rules.messages.required);
    });

    test('TC-FP-03 | Invalid email format is rejected', { tag: ['@regression', '@TC-FP-03'] }, async ({ forgotPasswordPage }) => {
      for (const email of invalidEmails) {
        await forgotPasswordPage.sendCode(email);
        await forgotPasswordPage.expectEmailError(ForgotPasswordFields.email.rules.messages.pattern);
      }
    });

    test('TC-FP-04 | Unregistered email is not accepted', { tag: ['@regression', '@TC-FP-04'] }, async ({ forgotPasswordPage }) => {
      // (D16) built wording reveals which emails are admins; waiting for PO / security
      await forgotPasswordPage.sendCode(unknownEmail());
      await forgotPasswordPage.expectBanner(ForgotPasswordMessages.unknownEmail);
    });

    test('TC-FP-05 | Registered email sends a code and opens the code screen', { tag: ['@smoke', '@regression', '@TC-FP-05'] }, async ({ forgotPasswordPage, codeVerificationPage }) => {
      // the request is held until "Sending…" has been checked, so a fast server can't make this check miss it
      const release = await forgotPasswordPage.act.holdRequests(ForgotPasswordApi.sendCode);
      await forgotPasswordPage.sendCode(adminEmail());
      await forgotPasswordPage.expectSending();
      await release();
      await codeVerificationPage.expectLoaded();
      await codeVerificationPage.verify.text(codeVerificationPage.fields.subtext, ForgotPasswordMessages.codeSentTo(adminEmail(), codeLength()));
    });

    test('TC-FP-06 | Back from the forgot screen goes to login', { tag: ['@regression', '@TC-FP-06'] }, async ({ forgotPasswordPage, loginPage }) => {
      await forgotPasswordPage.backToSignIn();
      await loginPage.expectLoaded();
    });

    test('TC-FP-40 | Forgot password screen is accessible', { tag: ['@regression', '@a11y', '@TC-FP-40'] }, async ({ forgotPasswordPage }) => {
      await forgotPasswordPage.verify.accessible();
    });
  });
});

test.describe('Forgot password: code screen', () => {
  test.use({ role: null });

  test.describe(() => {
    test.beforeEach(async ({ forgotPasswordPage, codeVerificationPage }) => {
      await reachCodeScreen(forgotPasswordPage, codeVerificationPage);
    });

    test('TC-FP-09 | Code screen shows its fields and texts', { tag: ['@regression', '@TC-FP-09'] }, async ({ codeVerificationPage }) => {
      await codeVerificationPage.expectAllControls(adminEmail(), codeLength());
    });

    test('TC-FP-10 | Only digits can be entered in the code', { tag: ['@regression', '@TC-FP-10'] }, async ({ codeVerificationPage }) => {
      await codeVerificationPage.typeKeys(nonDigitKeys);
      await codeVerificationPage.expectCode('');
      await codeVerificationPage.enterCode(pastedWithLetter);
      await codeVerificationPage.expectCode(/^\d*$/);
      await codeVerificationPage.expectNotChecked();
    });

    test('TC-FP-11 | Fewer digits than the code length are not checked', { tag: ['@regression', '@TC-FP-11'] }, async ({ codeVerificationPage }) => {
      await codeVerificationPage.enterCode(shortCode());
      await codeVerificationPage.expectCode(shortCode());
      await codeVerificationPage.expectNotChecked();
    });

    test('TC-FP-12 | Correct code opens the set-password screen', { tag: ['@smoke', '@regression', '@TC-FP-12'] }, async ({ codeVerificationPage, setPasswordPage }) => {
      const release = await codeVerificationPage.act.holdRequests(ForgotPasswordApi.verifyCode);
      await codeVerificationPage.enterCode(validCode());
      await codeVerificationPage.expectVerifying();
      await release();
      await setPasswordPage.expectLoaded();
    });

    test('TC-FP-13 | Wrong code is rejected', { tag: ['@regression', '@TC-FP-13'] }, async ({ codeVerificationPage }) => {
      pendingDecision('D7', 'Build shows "Incorrect code entered. Please try again."');
      await codeVerificationPage.enterCode(wrongCode());
      await codeVerificationPage.expectCodeRejected(ForgotPasswordMessages.invalidCode);
    });

    test('TC-FP-19 | Back from the code screen goes to login', { tag: ['@regression', '@TC-FP-19'] }, async ({ codeVerificationPage, loginPage }) => {
      pendingDecision('D11', 'Build\'s "Back to forgot password" goes to /auth/forgot-password, story says Login');
      await codeVerificationPage.back();
      await loginPage.expectLoaded();
    });

    test('TC-FP-41 | Code screen is accessible', { tag: ['@regression', '@a11y', '@TC-FP-41'] }, async ({ codeVerificationPage }) => {
      await codeVerificationPage.verify.visible(codeVerificationPage.fields.code); // labelled "Verification code"
      await codeVerificationPage.verify.accessible();
    });
  });

  test.describe('resend countdown', () => {
    // the clock is paused just before the code is sent: the 30 s countdown only moves with fastForward()
    test.beforeEach(async ({ forgotPasswordPage, codeVerificationPage }) => {
      await forgotPasswordPage.act.installClock();
      await reachCodeScreen(forgotPasswordPage, codeVerificationPage, () => forgotPasswordPage.act.pauseClock());
    });

    test('TC-FP-14 | Resend waits 30 s after the screen opens', { tag: ['@regression', '@TC-FP-14'] }, async ({ codeVerificationPage }) => {
      await codeVerificationPage.expectResendWaiting(30);
      await codeVerificationPage.act.fastForward(RESEND_WAIT_MS - 1_000);
      await codeVerificationPage.expectResendWaiting(1);
      await codeVerificationPage.act.fastForward(1_000);
      await codeVerificationPage.expectResendReady();
    });

    test('TC-FP-15 | Resend sends a new code', { tag: ['@regression', '@TC-FP-15'] }, async ({ codeVerificationPage }) => {
      await codeVerificationPage.enterCode(validCode().slice(0, 1));
      await codeVerificationPage.act.fastForward(RESEND_WAIT_MS + 1_000); // the countdown can run a tick late
      await codeVerificationPage.expectResendReady();
      const release = await codeVerificationPage.act.holdRequests(ForgotPasswordApi.resendCode);
      await codeVerificationPage.resend();
      await codeVerificationPage.expectResending();
      await release();
      await codeVerificationPage.expectResendToast(adminEmail(), codeLength());
      await codeVerificationPage.expectCode('');
      await codeVerificationPage.expectResendWaiting(30);
    });
  });

  test('TC-FP-16 | Resend can be used repeatedly', { tag: ['@regression', '@TC-FP-16'] }, async ({ forgotPasswordPage, codeVerificationPage }) => {
    // real time, no fake clock: the server refuses resends less than 30 s apart ("Please wait 30 seconds…")
    test.setTimeout(3 * 40_000 + 60_000);
    await reachCodeScreen(forgotPasswordPage, codeVerificationPage);
    for (let i = 0; i < 3; i++) {
      await codeVerificationPage.waitUntilResendReady();
      await codeVerificationPage.resend();
      await codeVerificationPage.expectResendToast(adminEmail(), codeLength());
    }
  });

  test('TC-FP-23 | Code screen can\'t be opened without its parameters', { tag: ['@regression', '@TC-FP-23'] }, async ({ codeVerificationPage, loginPage }) => {
    await codeVerificationPage.act.goto(codeVerificationPage.path);
    await loginPage.expectLoaded();
  });
});

test.describe('Forgot password: set-password screen', () => {
  test.use({ role: null });

  test.describe(() => {
    test.beforeEach(async ({ forgotPasswordPage, codeVerificationPage, setPasswordPage }) => {
      await reachCodeScreen(forgotPasswordPage, codeVerificationPage);
      await codeVerificationPage.enterCode(validCode());
      await setPasswordPage.expectLoaded();
    });

    test('TC-FP-24 | Set-password screen shows its fields and rules', { tag: ['@regression', '@TC-FP-24'] }, async ({ setPasswordPage }) => {
      await setPasswordPage.expectAllControls();
    });

    test('TC-FP-25 | Password checklist ticks rules while typing', { tag: ['@regression', '@TC-FP-25'] }, async ({ setPasswordPage }) => {
      for (const { typed, met } of checklistSteps) {
        await setPasswordPage.fill({ newPassword: typed });
        for (const rule of allRules) await setPasswordPage.expectRule(rule, met.includes(rule) ? 'green' : 'grey');
      }
    });

    test('TC-FP-26 | Password length boundary', { tag: ['@regression', '@TC-FP-26'] }, async ({ setPasswordPage }) => {
      pendingDecision('D9', 'Build shows "Your new password doesn\'t meet all the requirements yet."');
      const confirmRequired = SetPasswordFields.confirmPassword.rules.messages.required;
      // 7 characters: (D9) the build shows "Your new password doesn't meet all the requirements yet."
      await setPasswordPage.submit({ newPassword: sevenCharacters });
      await setPasswordPage.expectFieldErrors({ newPassword: SetPasswordFields.newPassword.rules.messages.pattern, confirmPassword: confirmRequired });
      await setPasswordPage.expectRule('length', 'red');
      // 8 characters: accepted by the rules (Confirm left empty, so nothing is reset)
      await setPasswordPage.submit({ newPassword: eightCharacters });
      await setPasswordPage.expectRule('length', 'green');
      await setPasswordPage.expectFieldErrors({ confirmPassword: confirmRequired });
    });

    test('TC-FP-27 | Password missing one rule is rejected', { tag: ['@regression', '@TC-FP-27'] }, async ({ setPasswordPage }) => {
      pendingDecision('D9', 'Build shows "Your new password doesn\'t meet all the requirements yet."');
      for (const { missing, password } of missingRuleCases) {
        await setPasswordPage.submit({ newPassword: password });
        await setPasswordPage.verify.text(setPasswordPage.fields.newPasswordError, SetPasswordFields.newPassword.rules.messages.pattern);
        await setPasswordPage.expectRule(missing, 'red');
      }
    });

    test('TC-FP-28 | Empty new password is rejected', { tag: ['@regression', '@TC-FP-28'] }, async ({ setPasswordPage }) => {
      pendingDecision('D8', 'Build shows "Enter a new password."');
      await setPasswordPage.submit();
      await setPasswordPage.verify.text(setPasswordPage.fields.newPasswordError, SetPasswordFields.newPassword.rules.messages.required);
    });

    test('TC-FP-29 | Empty confirm password is rejected', { tag: ['@regression', '@TC-FP-29'] }, async ({ setPasswordPage }) => {
      await setPasswordPage.submit({ newPassword: validNewPassword });
      await setPasswordPage.expectFieldErrors({ confirmPassword: SetPasswordFields.confirmPassword.rules.messages.required });
    });

    test('TC-FP-30 | Passwords that don\'t match are rejected', { tag: ['@regression', '@TC-FP-30'] }, async ({ setPasswordPage }) => {
      pendingDecision('D10', 'Build only shows the live hint "Both passwords have to match"');
      await setPasswordPage.submit({ newPassword: validNewPassword, confirmPassword: `${validNewPassword}x` });
      await setPasswordPage.expectMismatchError();
    });

    test('TC-FP-31 | Matching passwords show a confirmation hint', { tag: ['@regression', '@TC-FP-31'] }, async ({ setPasswordPage }) => {
      await setPasswordPage.fill({ newPassword: validNewPassword, confirmPassword: validNewPassword }); // not submitted
      await setPasswordPage.expectPasswordsMatchHint();
    });

    test('TC-FP-32 | Show/Hide works on both password fields', { tag: ['@regression', '@TC-FP-32'] }, async ({ setPasswordPage }) => {
      const values = { newPassword: validNewPassword, confirmPassword: `${validNewPassword}x` };
      await setPasswordPage.fill(values);
      await setPasswordPage.toggleNewPassword();
      await setPasswordPage.expectVisibility({ newPassword: true, confirmPassword: false });
      await setPasswordPage.toggleConfirmPassword();
      await setPasswordPage.expectVisibility({ newPassword: true, confirmPassword: true });
      await setPasswordPage.toggleNewPassword();
      await setPasswordPage.expectVisibility({ newPassword: false, confirmPassword: true });
      await setPasswordPage.toggleConfirmPassword();
      await setPasswordPage.expectVisibility({ newPassword: false, confirmPassword: false });
      await setPasswordPage.expectValues(values);
    });

    test('TC-FP-33 | Back from the set-password screen goes to login', { tag: ['@regression', '@TC-FP-33'] }, async ({ setPasswordPage, loginPage, dashboardPage }) => {
      await setPasswordPage.backToSignIn();
      await loginPage.expectLoaded();
      // the password is unchanged: the current one still signs in
      await loginPage.login(superAdmin);
      await dashboardPage.expectLoaded();
    });

    test('TC-FP-42 | Set-password screen is accessible', { tag: ['@regression', '@a11y', '@TC-FP-42'] }, async ({ setPasswordPage }) => {
      // the checklist state is announced to screen readers ("— met" / "— not met yet"), not only by colour
      await setPasswordPage.fill({ newPassword: 'a' });
      await setPasswordPage.expectRule('lowercase', 'green');
      await setPasswordPage.expectRule('uppercase', 'grey');
      await setPasswordPage.verify.accessible();
    });
  });

  test('TC-FP-34 | Set-password screen can\'t be opened without a session', { tag: ['@regression', '@TC-FP-34'] }, async ({ setPasswordPage, loginPage }) => {
    await setPasswordPage.act.goto(setPasswordPage.path);
    await loginPage.expectLoaded();
  });
});

test.describe('Forgot password while signed in', () => {
  // default role: the saved Super Admin session

  test('TC-FP-38 | Signed-in admin can\'t open the recovery screens', { tag: ['@regression', '@TC-FP-38'] }, async ({ forgotPasswordPage, dashboardPage }) => {
    await forgotPasswordPage.act.goto(forgotPasswordPage.path);
    await dashboardPage.expectLoaded();
  });
});
