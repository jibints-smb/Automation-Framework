/**
 * Forgot password test data — test-cases/web/forgot-password.testcases.md.
 * The code comes from .env: OTP_CODE is the fixed QA-only code staging accepts for the QA admin (until email is
 * set up), OTP_LENGTH its length (4 now, 6 once email goes live). Never hard-coded here.
 */
import { requireEnv } from '@core/config/env';
import { uniqueEmail } from '@core/utils/random';
import { type PasswordRule } from '@apps/bergen-kids-admin-web/models/web/forgot-password.model';

export const adminEmail = (): string => requireEnv('SUPERADMIN_EMAIL');
export const validCode = (): string => requireEnv('OTP_CODE');
export const codeLength = (): number => Number(requireEnv('OTP_LENGTH'));

/** The real code with its last digit changed: right length, certainly wrong. */
export const wrongCode = (): string => {
  const code = validCode();
  const last = (Number(code.at(-1)) + 1) % 10;
  return `${code.slice(0, -1)}${last}`;
};

/** One digit short of a full code: must not be checked. */
export const shortCode = (): string => validCode().slice(0, -1);

/** An email no admin account uses. */
export const unknownEmail = (): string => uniqueEmail();

/** TC-FP-03: each must show the invalid-format message. */
export const invalidEmails = ['admin', 'admin@', 'admin@bergen'] as const;

/** TC-FP-10: keys that must not appear in the code. */
export const nonDigitKeys = ['a', 'b', '#', '$', 'Space'];
export const pastedWithLetter = '12a4';

/** Meets all 5 rules. Never submitted twice (that would reset the admin's password). */
export const validNewPassword = 'Qa!7bergenKids';

/** TC-FP-25: typed one after another; each turns one more rule green. */
export const checklistSteps: { typed: string; met: PasswordRule[] }[] = [
  { typed: 'a', met: ['lowercase'] },
  { typed: 'aA', met: ['lowercase', 'uppercase'] },
  { typed: 'aA1', met: ['lowercase', 'uppercase', 'number'] },
  { typed: 'aA1!', met: ['lowercase', 'uppercase', 'number', 'special'] },
  { typed: 'aA1!aaaa', met: ['lowercase', 'uppercase', 'number', 'special', 'length'] },
];

/** TC-FP-26: meet every rule except length (7), and exactly the minimum (8). */
export const sevenCharacters = 'aA1!aaa';
export const eightCharacters = 'aA1!aaaa';

/** TC-FP-27: 8+ characters, each missing exactly one rule. */
export const missingRuleCases: { missing: PasswordRule; password: string }[] = [
  { missing: 'uppercase', password: 'qa1!qaqa' },
  { missing: 'lowercase', password: 'QA1!QAQA' },
  { missing: 'number', password: 'Qa!!qaqa' },
  { missing: 'special', password: 'Qa1qaqa1' },
];
