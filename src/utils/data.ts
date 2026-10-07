import { env } from '@core/config/env';

/**
 * Test data that differs per environment (TEST_ENV). `defaults` are used everywhere; an environment
 * listed in `overrides` replaces only the keys it sets. Secrets still come from the .env files, not from here.
 *
 * @example
 *   export const orderData = forEnv(
 *     { customerId: 'C-1001', product: 'Laptop 15"', currency: 'EUR' },
 *     { staging: { customerId: 'C-2002' }, uat: { customerId: 'C-3003', currency: 'USD' } },
 *   );
 */
export function forEnv<T extends object>(defaults: T, overrides: Partial<Record<string, Partial<T>>> = {}): T {
  return { ...defaults, ...overrides[env.name] };
}
