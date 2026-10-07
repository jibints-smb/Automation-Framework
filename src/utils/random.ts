/** Small helpers for unique test data (no extra dependencies). */
import { env } from '@core/config/env';

export function uniqueId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Unique name for a record a test creates, e.g. "qa-auto-customer-mg7k2x9fa1b2". The fixed start
 * (TEST_DATA_PREFIX, default "qa-auto") marks it as test data, so leftovers are easy to find and bulk-delete.
 */
export function testDataName(label: string): string {
  return `${env.testData.prefix}-${label}-${uniqueId()}`;
}

export function uniqueEmail(domain = 'example.com'): string {
  return `${env.testData.prefix}.${uniqueId()}@${domain}`;
}

export function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}
