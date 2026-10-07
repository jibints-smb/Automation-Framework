import { test, type Page } from '@playwright/test';
import { app, type PerformanceBudget } from '@core/config/app';

export type PageLoadMetrics = Required<Omit<PerformanceBudget, 'lcp' | 'cls'>> &
  Pick<PerformanceBudget, 'lcp' | 'cls'> & { url: string; requests: number };

const UNITS: Record<keyof PerformanceBudget, string> = {
  ttfb: 'ms',
  fcp: 'ms',
  lcp: 'ms',
  domContentLoaded: 'ms',
  load: 'ms',
  cls: '',
  kb: 'KB',
};

/**
 * Timings of the last full page load (browser Navigation Timing). Client-side route changes in a
 * single-page app are not page loads: measure right after `open()` / `goto()`.
 * `lcp` and `cls` are only measured by Chromium; `kb` misses cross-origin files without Timing-Allow-Origin.
 */
export async function measurePageLoad(page: Page): Promise<PageLoadMetrics> {
  await page.waitForLoadState('load');
  return page.evaluate(() => {
    const buffered = (type: string) => {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return undefined;
      const observer = new PerformanceObserver(() => {});
      observer.observe({ type, buffered: true });
      const entries = observer.takeRecords();
      observer.disconnect();
      return entries;
    };
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const lcp = buffered('largest-contentful-paint');
    const shifts = buffered('layout-shift') as (PerformanceEntry & { value: number; hadRecentInput: boolean })[] | undefined;
    const bytes = (nav?.transferSize ?? 0) + resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const ms = (n: number | undefined) => Math.round(n ?? 0);
    return {
      url: location.href,
      ttfb: ms(nav?.responseStart),
      fcp: ms(performance.getEntriesByName('first-contentful-paint')[0]?.startTime),
      lcp: lcp?.length ? ms(lcp[lcp.length - 1].startTime) : undefined,
      domContentLoaded: ms(nav?.domContentLoadedEventEnd),
      load: ms(nav?.loadEventEnd),
      cls: shifts ? Math.round(shifts.filter((s) => !s.hadRecentInput).reduce((sum, s) => sum + s.value, 0) * 1000) / 1000 : undefined,
      kb: Math.round(bytes / 1024),
      requests: resources.length + 1,
    };
  });
}

/**
 * Measure the page load and compare it with the budget (the app's `checks.performance`, overridden by `budget`).
 * The measured timings are always attached to the report ("Performance").
 */
export async function checkPerformance(page: Page, budget: PerformanceBudget = {}): Promise<PageLoadMetrics> {
  const metrics = await measurePageLoad(page);
  const limits = { ...app.checks?.performance, ...budget };
  const keys = Object.keys(UNITS) as (keyof PerformanceBudget)[];

  const over: string[] = [];
  const rows = keys.map((key) => {
    const value = metrics[key];
    const limit = limits[key];
    const fails = value !== undefined && limit !== undefined && value > limit;
    if (fails) over.push(`${key} ${value}${UNITS[key]} > ${limit}${UNITS[key]}`);
    const shown = value === undefined ? 'not measured' : `${value}${UNITS[key]}`;
    return `${key.padEnd(17)} ${shown.padEnd(14)} ${limit === undefined ? '' : `budget ${limit}${UNITS[key]}`}${fails ? '  ✗ OVER' : ''}`;
  });
  await test.info().attach('Performance', {
    body: [`Page: ${metrics.url}`, `Requests: ${metrics.requests}`, '', ...rows].join('\n'),
    contentType: 'text/plain',
  });

  if (over.length) throw new Error(`Performance budget exceeded on ${metrics.url}: ${over.join(', ')}`);
  return metrics;
}
