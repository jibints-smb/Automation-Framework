/**
 * Login page — field model.
 * Source: requirements/web/BK-1-login.md
 * The app has no test IDs: locators by role / label; field errors by the developers' ids (#lg-email, #lg-pass).
 */
import { defineWebFields, type FormData } from '@core/models/field.types';

export const LoginFields = defineWebFields({
  email: {
    label: 'Email address',
    type: 'email',
    locator: { role: 'textbox', name: 'Email address', exact: true },
    rules: {
      required: true,
      // Jira story texts; the build shows "Enter your email address" / "Enter a valid email address" (D1, PO decision)
      messages: { required: 'Please enter your email address.', pattern: 'Please enter a valid email address.' },
    },
  },
  password: {
    label: 'Password',
    type: 'password',
    // by label: stays the same field when "Show password" switches it to a text input
    locator: { label: 'Password', exact: true },
    // Jira story text; the build shows "Enter your password" (D1)
    rules: { required: true, messages: { required: 'Please enter your password.' } },
  },
  keepSignedIn: {
    label: 'Keep me signed in',
    type: 'checkbox',
    locator: { label: 'Keep me signed in' },
  },
  showPassword: { label: 'Show password', type: 'button', locator: { role: 'button', name: 'Show password', exact: true } },
  hidePassword: { label: 'Hide password', type: 'button', locator: { role: 'button', name: 'Hide password', exact: true } },
  forgotLink: { label: 'Forgot?', type: 'link', locator: { role: 'link', name: 'Forgot?', exact: true } },
  signInButton: { label: 'Sign in to dashboard', type: 'button', locator: { role: 'button', name: 'Sign in to dashboard' } },
  emailError: { label: 'Email error', type: 'label', locator: { css: 'form div:has(#lg-email) > p[role="alert"]' } },
  passwordError: { label: 'Password error', type: 'label', locator: { css: 'form div:has(#lg-pass) > p[role="alert"]' } },
  heading: { label: 'Heading', type: 'label', locator: { role: 'heading', name: 'Sign in to the admin panel' } },
  subheading: { label: 'Subheading', type: 'label', locator: { text: 'Use your Bergen Kids admin credentials to login.' } },
  toast: { label: 'Toast', type: 'label', locator: { role: 'status' } },
  themeToggle: { label: 'Switch colour theme', type: 'button', locator: { role: 'button', name: 'Switch colour theme' } },
  /** `data-theme` on <html> is "light" or "dark". */
  pageRoot: { label: 'Page', type: 'label', locator: { css: 'html' } },
  /** "© 2026 Bergen Kids · Secure admin access · v0.2.0": changes with every build, masked in screenshots. */
  footer: { label: 'Footer', type: 'label', locator: { text: /Secure admin access/ } },
  /** Right-hand panel: its background photos rotate (a different one on each load), so it is masked in screenshots. */
  heroPanel: { label: 'Hero panel', type: 'label', locator: { css: 'section:has(h1)' } },
});

/** Messages that don't belong to a single field. */
export const LoginMessages = {
  pageTitle: /^Sign in\b/, // "Sign in | Bergen Kids Admin"
  invalidCredentials: 'Invalid email address or password. Please try again.',
  welcomeToast: /Welcome back\s*Signing you in…/, // title "Welcome back", text "Signing you in…"
} as const;

/** localStorage key of the saved login ("Keep me signed in"). */
export const REMEMBERED_LOGIN_KEY = 'bk-admin-remembered-login';

/** `{ email?: string; password?: string; keepSignedIn?: boolean }` — derived from the model. */
export type LoginData = FormData<typeof LoginFields>;
