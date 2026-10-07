/**
 * Mobile app login screen — field model.
 * Source: requirements/mobile/MOB-201-login.md
 *
 * NOTE: these accessibility IDs are placeholders. Replace them with your app's
 * IDs (find them with Appium Inspector, or ask the developers to add them).
 */
import { defineMobileFields, type FormData } from '@core/models/field.types';

export const MobileLoginFields = defineMobileFields({
  username: {
    label: 'Username',
    type: 'text',
    locator: { accessibilityId: 'login-username' },
    rules: { required: true, messages: { required: 'Username is required' } },
  },
  password: {
    label: 'Password',
    type: 'password',
    locator: { accessibilityId: 'login-password' },
    rules: { required: true, messages: { required: 'Password is required' } },
  },
  rememberMe: {
    label: 'Remember me',
    type: 'checkbox',
    locator: {
      android: { id: 'com.company.app:id/remember_me' },
      ios: { accessibilityId: 'login-remember-me' },
    },
  },
  loginButton: { label: 'Login button', type: 'button', locator: { accessibilityId: 'login-button' } },
  errorMessage: { label: 'Error message', type: 'label', locator: { accessibilityId: 'login-error' } },
});

export const MobileLoginMessages = {
  invalidCredentials: 'Invalid username or password',
} as const;

/** `{ username?: string; password?: string; rememberMe?: boolean }` */
export type MobileLoginData = FormData<typeof MobileLoginFields>;
