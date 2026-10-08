// Shared helpers for the QA Studio API: the root settings, apps and their configuration.
import fs from 'node:fs';
import path from 'node:path';
import { envValue, readEnv } from './envfile.mjs';

export const ROOT_ENV = '.env';
export const APPS_DIR = 'apps';

/** Apps under apps/ (folders with an app.config.ts). */
export function listApps() {
  return fs.existsSync(APPS_DIR)
    ? fs.readdirSync(APPS_DIR).filter((a) => fs.existsSync(path.join(APPS_DIR, a, 'app.config.ts'))).sort()
    : [];
}

/** Throws a 404-style error unless `app` is an existing app folder name. */
export function requireApp(app) {
  if (typeof app !== 'string' || !listApps().includes(app)) {
    throw Object.assign(new Error(`Unknown app "${app}"`), { status: 404 });
  }
  return app;
}

/** A root .env setting (process environment wins, like the framework). */
export function rootSetting(key, fallback = '') {
  return process.env[key] ?? envValue(ROOT_ENV, key) ?? fallback;
}

/** Who is testing what: the header of every Studio page. */
export function currentContext() {
  const apps = listApps();
  const app = rootSetting('APP') || (apps.length === 1 ? apps[0] : '');
  return {
    app: apps.includes(app) ? app : '',
    apps,
    environment: rootSetting('TEST_ENV') || 'qa',
    qaName: rootSetting('QA_NAME'),
    qaEmail: rootSetting('QA_EMAIL'),
    build: rootSetting('BUILD_VERSION'),
    sprint: rootSetting('SPRINT'),
    release: rootSetting('RELEASE'),
    rootEnvExists: fs.existsSync(ROOT_ENV),
  };
}

/**
 * What an app.config.ts declares (read as text: the config is TypeScript and may import page objects).
 * Good enough for display and for building run options.
 */
export function appInfo(app) {
  const file = path.join(APPS_DIR, app, 'app.config.ts');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const pick = (re) => text.match(re)?.[1];
  const list = (re) => (pick(re) ?? '').split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const platforms = list(/platforms:\s*\[([^\]]*)\]/);
  const browsers = list(/browsers:\s*\[([^\]]*)\]/);
  const roles = [...text.matchAll(/^\s*(\w+):\s*\{\s*usernameEnv:\s*'([^']+)',\s*passwordEnv:\s*'([^']+)'/gm)]
    .filter((m) => !/^\s*\/\//.test(m[0]))
    .map((m) => ({ role: m[1], usernameEnv: m[2], passwordEnv: m[3] }));
  const appDir = path.join(APPS_DIR, app);
  return {
    app,
    name: pick(/name:\s*'([^']+)'/) ?? app,
    platforms,
    browsers: browsers.length ? browsers : platforms.includes('web') ? ['chrome'] : [],
    baseUrl: envValue(path.join(appDir, '.env'), 'BASE_URL') || pick(/baseUrl:\s*'([^']+)'/) || '',
    testIdAttribute: pick(/testIdAttribute:\s*'([^']+)'/) ?? 'data-testid',
    roles,
    defaultRole: pick(/^\s*defaultRole:\s*'([^']+)'/m) ?? '',
    envFiles: fs.existsSync(appDir) ? fs.readdirSync(appDir).filter((f) => /^\.env(\.[a-z0-9-]+)?$/.test(f)) : [],
  };
}

/** Playwright projects of an app (same rules as playwright.config.ts). */
export function appProjects(info) {
  const projects = [];
  if (info.platforms.includes('web')) projects.push(...info.browsers.map((b) => `web-${b}`));
  if (info.platforms.includes('mobile-web')) projects.push('mobile-web-android', 'mobile-web-ios');
  if (info.platforms.includes('android')) projects.push('android-app');
  if (info.platforms.includes('ios')) projects.push('ios-app');
  if (info.platforms.includes('api')) projects.push('api');
  return projects;
}

/** Settings of one env file for the browser: secrets as { set } only. */
export function envForBrowser(file) {
  return readEnv(file);
}
