import path from 'node:path';
import { ROOT_DIR, env } from './env';

/**
 * Saved browser session (cookies, local storage, IndexedDB) of a logged-in role for the active app and
 * environment: switching TEST_ENV never reuses another environment's login.
 */
export function authFile(role: string): string {
  return path.join(ROOT_DIR, '.auth', env.app, env.name, `${role}.json`);
}
