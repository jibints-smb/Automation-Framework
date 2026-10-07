/**
 * Per-application configuration. Every app has `apps/<name>/app.config.ts`:
 *
 *   export default defineApp({ name: 'Shop', platforms: ['web'], web: { baseUrl: 'https://qa.shop.com' } });
 *
 * The active app (APP setting) is loaded here and exposed as `app` and `settings`.
 */
import path from 'node:path';
import type { Page } from '@playwright/test';
import type { Platform } from '../mobile/capabilities';
import type { MobileDriver } from '../mobile/driver';
import { APP_DIR, env } from './env';

/** `api`: tests/api, HTTP only (no browser or device). */
export type PlatformName = 'web' | 'mobile-web' | 'android' | 'ios' | 'api';

export interface RoleAccount {
  /** Name of the setting holding the username, e.g. 'ADMIN_USERNAME'. */
  usernameEnv: string;
  /** Name of the setting holding the password, e.g. 'ADMIN_PASSWORD'. */
  passwordEnv: string;
}

export interface AppConfig {
  /** Display name, used in the report. */
  name: string;
  /** Which kinds of test runs this app has. Decides the Playwright projects. */
  platforms: PlatformName[];

  web?: {
    baseUrl: string;
    /** Attribute developers use for test IDs. Default: data-testid */
    testIdAttribute?: string;
  };

  api?: {
    /** Defaults to web.baseUrl. */
    baseUrl?: string;
    headers?: Record<string, string>;
  };

  /**
   * Login roles; each test starts logged in as its role (`test.use({ role })`).
   *  - web:    `login` runs once per role before the tests and the session is reused
   *  - native: `mobile.login` runs at the start of each test
   * Leave out for apps without login.
   */
  auth?: {
    defaultRole: string;
    roles: Record<string, RoleAccount>;
    /** Log in on a fresh page and wait until logged in. Leave out for apps without a web login. */
    login?: (page: Page, credentials: Credentials) => Promise<void>;
  };

  /** App defaults for the quality checks in `verify` (each call can override them). */
  checks?: {
    /** `verify.accessible()` */
    accessibility?: AccessibilitySettings;
    /** `verify.performance()`: default budget for every page. */
    performance?: PerformanceBudget;
    /** `verify.looksLike()`: share of pixels that may differ (0–1). Default 0.01. */
    visualMaxDiffRatio?: number;
  };

  /** Native app (Appium) settings. */
  mobile?: {
    /**
     * Extra Appium capabilities per platform, merged over the defaults from `.env`.
     * React Native apps need `{ android: { 'appium:disableIdLocatorAutocompletion': true } }`
     * so `{ id: '<testID>' }` locators work on Android.
     */
    capabilities?: Partial<Record<Platform, Record<string, string | number | boolean>>>;
    /**
     * Log in on the freshly started app and wait until logged in. Runs before each native test
     * whose role is set; leave out when tests start on the login screen.
     */
    login?: (session: { driver: MobileDriver; platform: Platform }, credentials: Credentials) => Promise<void>;
  };
}

export type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

export interface AccessibilitySettings {
  /** axe rule tags to check. Default: WCAG 2.1 A + AA. */
  standard?: string[];
  /** Lowest impact that fails the test. Default: 'serious'. Lower ones are only attached to the report. */
  failOn?: Impact;
  /** axe rule IDs not checked, e.g. known issues with a Jira ticket: `['color-contrast']`. */
  ignoreRules?: string[];
  /** CSS selectors left out of the scan, e.g. third-party widgets. */
  exclude?: string[];
}

/** Limits in milliseconds (cls: layout shift score, kb: total transferred). Leave a key out to not check it. */
export interface PerformanceBudget {
  /** Time to first byte. */
  ttfb?: number;
  /** First contentful paint. */
  fcp?: number;
  /** Largest contentful paint (Chromium only). */
  lcp?: number;
  domContentLoaded?: number;
  load?: number;
  /** Cumulative layout shift (Chromium only), e.g. 0.1. */
  cls?: number;
  /** Total KB transferred by the page load. */
  kb?: number;
}

export interface Credentials {
  username: string;
  password: string;
}

export function defineApp(config: AppConfig): AppConfig {
  return config;
}

export const app: AppConfig = require(path.join(APP_DIR, 'app.config.ts')).default;

/** Final values: environment settings override the app's defaults. */
export const settings = {
  baseUrl: env.web.baseUrl || app.web?.baseUrl || '',
  testIdAttribute: env.web.testIdAttribute || app.web?.testIdAttribute || 'data-testid',
  apiBaseUrl: env.api.baseUrl || app.api?.baseUrl || env.web.baseUrl || app.web?.baseUrl || '',
  apiHeaders: {
    ...app.api?.headers,
    ...(env.api.token ? { Authorization: `Bearer ${env.api.token}` } : {}),
  },
} as const;
