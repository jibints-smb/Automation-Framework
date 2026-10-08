/**
 * Login test data — test-cases/web/login.testcases.md.
 * The real account comes from apps/bergen-kids-admin-web/.env, never hard-coded here.
 */
import { getEnv } from '@core/config/env';
import { uniqueEmail, uniqueId } from '@core/utils/random';
import { LoginFields, type LoginData } from '@apps/bergen-kids-admin-web/models/web/login.model';

export const superAdmin = {
  email: getEnv('SUPERADMIN_EMAIL'),
  password: getEnv('SUPERADMIN_PASSWORD'),
};

/** A password that is certainly wrong for the Super Admin. */
export const wrongPassword = (): string => `Wrong#${uniqueId()}`;

/** An email no admin account uses. */
export const unknownEmail = (): string => uniqueEmail();

/** TC-LOGIN-05: each must show the invalid-format message. */
export const invalidEmails = ['admin', 'admin@', 'admin.bergen.com', 'admin@bergen'] as const;

interface ValidationCase {
  id: string;
  title: string;
  data: LoginData;
  errors: { email?: string; password?: string };
}

const messages = {
  emailRequired: LoginFields.email.rules.messages.required,
  passwordRequired: LoginFields.password.rules.messages.required,
};

/** Empty-field cases: the form shows field errors and no sign-in happens. Texts follow the story (D1). */
export const emptyFieldCases: ValidationCase[] = [
  {
    id: 'TC-LOGIN-04',
    title: 'Empty email is rejected',
    data: { password: wrongPassword() },
    errors: { email: messages.emailRequired },
  },
  {
    id: 'TC-LOGIN-06',
    title: 'Empty password is rejected',
    data: { email: superAdmin.email },
    errors: { password: messages.passwordRequired },
  },
  {
    id: 'TC-LOGIN-07',
    title: 'Both fields empty show both messages',
    data: {},
    errors: { email: messages.emailRequired, password: messages.passwordRequired },
  },
];
