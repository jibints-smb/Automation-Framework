/**
 * Forgot password: screen 1 (`/auth/forgot-password`), screen 2 (`/auth/code-verification`),
 * screen 3 (`/auth/set-password`) — field models.
 * Source: requirements/web/BK-2-forgot-password.md
 * No test IDs: locators by role / label; field errors by the developers' ids (#fp-email, #sp-password, #sp-confirm).
 * `role="alert"` alone is not enough: Next.js keeps a hidden route announcer with that role.
 */
import { defineWebFields, type FormData, type WebField } from '@core/models/field.types';

/** Screen 1: enter the email. */
export const ForgotPasswordFields = defineWebFields({
  email: {
    label: 'Email address',
    type: 'email',
    locator: { role: 'textbox', name: 'Email address', exact: true },
    rules: {
      required: true,
      messages: { required: 'Enter your email address', pattern: 'Enter a valid email address' },
    },
  },
  eyebrow: { label: 'Account recovery', type: 'label', locator: { text: 'Account recovery', exact: true } },
  heading: { label: 'Heading', type: 'label', locator: { role: 'heading', name: 'Forgot your password?' } },
  subheading: {
    label: 'Subheading',
    type: 'label',
    locator: { text: 'Enter your registered email and we’ll send you a verification code.' },
  },
  sendButton: { label: 'Send verification code', type: 'button', locator: { role: 'button', name: 'Send verification code' } },
  sendingButton: { label: 'Sending…', type: 'button', locator: { role: 'button', name: 'Sending…' } },
  emailError: { label: 'Email error', type: 'label', locator: { css: 'form div:has(#fp-email) > p[role="alert"]' } },
  /** Red banner with the API's message. */
  banner: { label: 'Error banner', type: 'label', locator: { css: 'div[role="alert"]:not(#__next-route-announcer__)' } },
  backLink: { label: '← Back to sign in', type: 'link', locator: { role: 'link', name: '← Back to sign in' } },
});

/** Screen 2: enter the code. */
export const CodeVerificationFields = defineWebFields({
  /** One input behind the digit boxes; fill() puts each digit in its box. */
  code: { label: 'Verification code', type: 'text', locator: { label: 'Verification code' } },
  heading: { label: 'Heading', type: 'label', locator: { role: 'heading', name: 'Verify your email' } },
  subtext: { label: 'Code sent to', type: 'label', locator: { text: /digit code sent to/ } },
  verifying: { label: 'Verifying…', type: 'label', locator: { text: 'Verifying…' } },
  codeError: { label: 'Code error', type: 'label', locator: { css: 'p[role="alert"]' } },
  resendButton: { label: 'Resend code', type: 'button', locator: { role: 'button', name: 'Resend code' } },
  resendingButton: { label: 'Sending…', type: 'button', locator: { role: 'button', name: 'Sending…' } },
  /** " in 30s" next to "Resend code" while it is disabled. */
  countdown: { label: 'Resend countdown', type: 'label', locator: { css: 'button:text-is("Resend code") + span' } },
  toast: { label: 'Toast', type: 'label', locator: { role: 'status' } },
  /** Story: back to sign in; build: "← Back to forgot password" (D11). */
  backLink: { label: 'Back link', type: 'link', locator: { role: 'link', name: /^← Back to/ } },
});

/** Screen 3: set the new password. */
export const SetPasswordFields = defineWebFields({
  newPassword: {
    label: 'New password',
    type: 'password',
    locator: { label: 'New password', exact: true },
    rules: {
      required: true,
      minLength: 8,
      // Jira story texts; the build shows "Enter a new password." (D8) /
      // "Your new password doesn't meet all the requirements yet." (D9)
      messages: { required: 'Please enter a new password.', pattern: 'Password does not meet the required criteria.' },
    },
  },
  confirmPassword: {
    label: 'Confirm password',
    type: 'password',
    locator: { label: 'Confirm password', exact: true },
    // mismatch: story text; the build only shows the hint "Both passwords have to match" (D10)
    rules: { required: true, messages: { required: 'Please confirm your new password.', invalid: 'Passwords do not match. Please try again.' } },
  },
  heading: { label: 'Heading', type: 'label', locator: { role: 'heading', name: 'Set a new password' } },
  subheading: { label: 'Subheading', type: 'label', locator: { text: /^Choose a password you don.t use anywhere else\.$/ } },
  showNewPassword: {
    label: 'Show/Hide new password',
    type: 'button',
    locator: { css: 'div:has(#sp-password) > button[aria-label$="password"]' },
  },
  showConfirmPassword: {
    label: 'Show/Hide confirm password',
    type: 'button',
    locator: { css: 'div:has(#sp-confirm) > button[aria-label$="password"]' },
  },
  rules: { label: 'Password checklist', type: 'label', locator: { css: '#sp-password-rules li' } },
  newPasswordError: { label: 'New password error', type: 'label', locator: { css: 'form div:has(#sp-password) > p[role="alert"]' } },
  confirmPasswordError: { label: 'Confirm password error', type: 'label', locator: { css: 'form div:has(#sp-confirm) > p[role="alert"]' } },
  mismatchError: { label: 'Mismatch error', type: 'label', locator: { text: 'Passwords do not match. Please try again.' } },
  /** Live hint under Confirm password: "Both passwords match" / "Both passwords have to match". */
  matchHint: { label: 'Match hint', type: 'label', locator: { text: /^Both passwords/ } },
  setButton: { label: 'Set password', type: 'button', locator: { role: 'button', name: 'Set password' } },
  backLink: { label: '← Back to sign in', type: 'link', locator: { role: 'link', name: '← Back to sign in' } },
});

/** The 5 rules of the checklist, as shown on the page. */
export const PasswordRules = {
  length: 'At least 8 characters',
  uppercase: 'An uppercase letter',
  lowercase: 'A lowercase letter',
  number: 'A number',
  special: 'A special character',
} as const;
export type PasswordRule = keyof typeof PasswordRules;

/** One rule of the checklist. Met rules carry the screen-reader text "— met", unmet ones "— not met yet". */
export const SetPasswordDynamicFields = {
  rule: (rule: PasswordRule): WebField => ({
    label: `Rule "${PasswordRules[rule]}"`,
    type: 'label',
    locator: { css: `#sp-password-rules li:has-text("${PasswordRules[rule]}")` },
  }),
};

/** Colour class of a checklist rule: grey (not met), green (met), red (not met after a failed submit). */
export const RuleColour = { grey: /text-muted-ink/, green: /text-brand/, red: /text-danger-t/ } as const;

export const ForgotPasswordMessages = {
  pageTitle: /^Forgot password\b/,
  codePageTitle: /^Verify your email\b/,
  setPasswordTitle: /^Set password\b/,
  /** D16: tells anyone which emails are admins; wording waits for PO / security. */
  unknownEmail: 'No admin account found with that email address.',
  /** Story text; the build shows "Incorrect code entered. Please try again." (D7). */
  invalidCode: 'Invalid verification code. Please try again.',
  codeSentTo: (email: string, length: number) => `Enter the ${length}-digit code sent to ${email}`,
  resendToast: (email: string, length: number) =>
    new RegExp(`New code sent\\s*Check ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} for a fresh ${length}-digit code\\.`),
  passwordsMatch: 'Both passwords match',
} as const;

/**
 * API calls the browser makes (straight to the API host, e.g. https://bergenapi.newagesmb.com — not server-side as
 * the requirement's section 10 says), so they can be held or mocked from the test.
 */
export const ForgotPasswordApi = {
  sendCode: /\/admin\/auth\/password\/forgot\b/,
  verifyCode: /\/admin\/auth\/password\/otp\/verify\b/,
  resendCode: /\/admin\/auth\/password\/otp\/resend\b/,
} as const;

export type ForgotPasswordData = FormData<typeof ForgotPasswordFields>;
export type SetPasswordData = FormData<typeof SetPasswordFields>;
