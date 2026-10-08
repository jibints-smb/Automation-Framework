/**
 * Test data for Advertiser Accounts (BK-7).
 *
 * Advertisers can't be created in the admin panel (they sign up on the website / app), so most tests read the
 * advertisers that exist from the page. Tests that change an advertiser use a SEEDED QA advertiser from the app .env,
 * never a real one (blocking hides an advertiser's live ads): they skip until it is set.
 */
import { getEnv } from '@core/config/env';
import { uniqueId } from '@core/utils/random';

/** A seeded, approved QA advertiser (email) that block / unblock tests may change and restore. */
export const seededApprovedAdvertiser = (): string => getEnv('QA_ADV_APPROVED_EMAIL');

export const needsSeededAdvertiser =
  'Needs QA_ADV_APPROVED_EMAIL in apps/bergen-kids-admin-web/.env: the email of a seeded QA advertiser (not a real business) that tests may block and unblock';

/** A search text no advertiser has. */
export const noMatchTerm = (): string => `zz-no-match-${uniqueId()}`;

/** Part of a value to search for: the first word of a name, the domain of an email, 6 digits of a phone. */
export const partOf = {
  name: (company: string) => company.split(/\s+/)[0],
  emailDomain: (email: string) => email.split('@')[1],
  phoneDigits: (phone: string) => phone.replace(/\D/g, '').slice(-10, -4),
};
