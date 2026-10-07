import { test } from '@playwright/test';
import { recordStep } from '@core/report/runLog';

/**
 * Wraps an action in a named step. Steps show up in the Allure report,
 * the Playwright HTML report and the trace viewer, and in the "Steps to reproduce" of the bug report.
 * `box: true` makes failures point at the calling test line, not inside the framework.
 */
export function step<T>(title: string, body: () => Promise<T>): Promise<T> {
  return test.step(title, () => recordStep(title, body), { box: true });
}

/** Hide secrets in step titles and logs. */
export function mask(value: string, sensitive: boolean): string {
  return sensitive ? '*'.repeat(Math.min(value.length, 8)) : value;
}
