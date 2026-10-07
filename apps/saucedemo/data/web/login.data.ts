/**
 * Login test data — one entry per test case in test-cases/web/login.testcases.md.
 * Real credentials come from apps/saucedemo/.env, never hard-coded here.
 */
import { getEnv } from '@core/config/env';
import { LoginFields, LoginMessages, type LoginData } from '@apps/saucedemo/models/web/login.model';

export const validUser: LoginData = {
  username: getEnv('WEB_USERNAME'),
  password: getEnv('WEB_PASSWORD'),
};

interface NegativeCase {
  id: string;
  title: string;
  data: LoginData;
  error: string;
}

export const invalidLoginCases: NegativeCase[] = [
  {
    id: 'TC-LOGIN-02',
    title: 'Wrong password shows credentials error',
    data: { username: getEnv('WEB_USERNAME'), password: 'wrong_password' },
    error: LoginMessages.invalidCredentials,
  },
  {
    id: 'TC-LOGIN-03',
    title: 'Locked out user cannot log in',
    data: { username: 'locked_out_user', password: getEnv('WEB_PASSWORD') },
    error: LoginMessages.lockedOut,
  },
  {
    id: 'TC-LOGIN-04',
    title: 'Empty username shows required error',
    data: { password: getEnv('WEB_PASSWORD') },
    error: LoginFields.username.rules.messages.required,
  },
  {
    id: 'TC-LOGIN-05',
    title: 'Empty password shows required error',
    data: { username: getEnv('WEB_USERNAME') },
    error: LoginFields.password.rules.messages.required,
  },
];
