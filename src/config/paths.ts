import path from 'node:path';
import { ROOT_DIR, env } from './env';

/** Saved browser session (cookies, local storage) of a logged-in role for the active app. */
export function authFile(role: string): string {
  return path.join(ROOT_DIR, '.auth', env.app, `${role}.json`);
}
