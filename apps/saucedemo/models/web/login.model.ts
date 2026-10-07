/**
 * Login page — field model.
 * Source: requirements/web/SCRUM-101-login.md
 */
import { defineWebFields, type FormData } from '@core/models/field.types';

export const LoginFields = defineWebFields({
  username: {
    label: 'Username',
    type: 'text',
    locator: { testId: 'username' },
    rules: { required: true, messages: { required: 'Epic sadface: Username is required' } },
  },
  password: {
    label: 'Password',
    type: 'password',
    locator: { testId: 'password' },
    rules: { required: true, messages: { required: 'Epic sadface: Password is required' } },
  },
  loginButton: {
    label: 'Login button',
    type: 'button',
    locator: { testId: 'login-button' },
  },
  errorMessage: {
    label: 'Error message',
    type: 'label',
    locator: { testId: 'error' },
  },
});

/** Messages that don't belong to a single field. */
export const LoginMessages = {
  invalidCredentials: 'Epic sadface: Username and password do not match any user in this service',
  lockedOut: 'Epic sadface: Sorry, this user has been locked out.',
} as const;

/** `{ username?: string; password?: string }` — derived from the model. */
export type LoginData = FormData<typeof LoginFields>;
