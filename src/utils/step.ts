import { test } from '@playwright/test';
import { recordStep } from '@core/report/runLog';
import { redact } from './redact';

/**
 * Wraps an action in a named step. Steps show up in the Allure report,
 * the Playwright HTML report and the trace viewer, and in the "Steps to reproduce" of the bug report.
 * `box: true` makes failures point at the calling test line, not inside the framework.
 */
export function step<T>(title: string, body: () => Promise<T>): Promise<T> {
  // secrets that reach a title (a URL with a token, a password from .env) are masked here
  const safe = redact(title);
  return test.step(safe, () => recordStep(safe, body), { box: true });
}

/** Hide a sensitive value in step titles and logs (fixed mask: doesn't reveal the length). */
export function mask(value: string, sensitive: boolean): string {
  return sensitive ? '****' : value;
}
