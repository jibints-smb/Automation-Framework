import { expect, type Page } from '@playwright/test';
import { isSensitive, type WebField } from '@core/models/field.types';
import type { PerformanceBudget } from '@core/config/app';
import { mask, step } from '@core/utils/step';
import { checkAccessibility, type AccessibilityOptions } from './accessibility';
import { locateField } from './locator';
import { checkPerformance, type PageLoadMetrics } from './performance';

/**
 * Readable, auto-waiting assertions on model fields.
 * Each check is a named report step, e.g. `Verify "Error message" has text "..."`.
 */
export class WebAssertions {
  private readonly expect: typeof expect;

  constructor(
    private readonly page: Page,
    private readonly options: { soft?: boolean } = {},
  ) {
    this.expect = options.soft ? expect.soft : expect;
  }

  /**
   * The same checks, but a failure doesn't stop the test: every failed soft check is reported at the end.
   * For screens with many independent texts: `await this.verify.soft.text(F.title, '...')`.
   */
  get soft(): WebAssertions {
    return new WebAssertions(this.page, { soft: true });
  }

  async visible(field: WebField): Promise<void> {
    await step(`Verify "${field.label}" is visible`, () => this.expect(locateField(this.page, field)).toBeVisible());
  }

  async hidden(field: WebField): Promise<void> {
    await step(`Verify "${field.label}" is hidden`, () => this.expect(locateField(this.page, field)).toBeHidden());
  }

  async text(field: WebField, expected: string | RegExp): Promise<void> {
    await step(`Verify "${field.label}" has text "${expected}"`, () =>
      this.expect(locateField(this.page, field)).toHaveText(expected),
    );
  }

  async containsText(field: WebField, expected: string | RegExp): Promise<void> {
    await step(`Verify "${field.label}" contains "${expected}"`, () =>
      this.expect(locateField(this.page, field)).toContainText(expected),
    );
  }

  async value(field: WebField, expected: string | RegExp): Promise<void> {
    const shown = typeof expected === 'string' ? mask(expected, isSensitive(field)) : expected;
    await step(`Verify "${field.label}" has value "${shown}"`, () =>
      this.expect(locateField(this.page, field)).toHaveValue(expected),
    );
  }

  /** E.g. a masked password (`type` = `password`), a placeholder, or a theme flag (`data-theme` on `html`). */
  async attribute(field: WebField, name: string, expected: string | RegExp): Promise<void> {
    await step(`Verify "${field.label}" has ${name} "${expected}"`, () =>
      this.expect(locateField(this.page, field)).toHaveAttribute(name, expected),
    );
  }

  /** Whether the page's localStorage holds `key` (e.g. a remembered login). Waits like the other checks. */
  async storedItem(key: string, present = true): Promise<void> {
    await step(`Verify localStorage ${present ? 'has' : 'has no'} "${key}"`, () =>
      expect.poll(() => this.page.evaluate((k) => localStorage.getItem(k) !== null, key)).toBe(present),
    );
  }

  async count(field: WebField, expected: number): Promise<void> {
    await step(`Verify ${expected} x "${field.label}"`, () =>
      this.expect(locateField(this.page, field)).toHaveCount(expected),
    );
  }

  /** `timeout` (ms) for states that take longer than the default wait, e.g. a button enabled after a real countdown. */
  async enabled(field: WebField, enabled = true, options: { timeout?: number } = {}): Promise<void> {
    await step(`Verify "${field.label}" is ${enabled ? 'enabled' : 'disabled'}`, () =>
      enabled
        ? this.expect(locateField(this.page, field)).toBeEnabled(options)
        : this.expect(locateField(this.page, field)).toBeDisabled(options),
    );
  }

  async focused(field: WebField): Promise<void> {
    await step(`Verify "${field.label}" is focused`, () => this.expect(locateField(this.page, field)).toBeFocused());
  }

  async checked(field: WebField, checked = true): Promise<void> {
    await step(`Verify "${field.label}" is ${checked ? 'checked' : 'unchecked'}`, () =>
      this.expect(locateField(this.page, field)).toBeChecked({ checked }),
    );
  }

  async url(expected: string | RegExp): Promise<void> {
    await step(`Verify URL matches "${expected}"`, () => this.expect(this.page).toHaveURL(expected));
  }

  async title(expected: string | RegExp): Promise<void> {
    await step(`Verify page title "${expected}"`, () => this.expect(this.page).toHaveTitle(expected));
  }

  /**
   * WCAG check of the page (or the part `within` a CSS selector) with axe-core. Defaults: WCAG 2.1 AA,
   * fails on serious/critical violations; set app-wide in app.config.ts `checks.accessibility`.
   */
  async accessible(options: AccessibilityOptions = {}): Promise<void> {
    await step(`Verify page is accessible${options.within ? ` (${options.within})` : ''}`, () => checkAccessibility(this.page, options));
  }

  /**
   * Compare the page (or one field) with its approved screenshot `<name>.png` in apps/<app>/screenshots/.
   * `mask` hides changing content (dates, IDs, ads). Approve a new look with `npm run visual:update -- <spec>`.
   */
  async looksLike(name: string, options: { field?: WebField; mask?: WebField[]; fullPage?: boolean; maxDiffRatio?: number } = {}): Promise<void> {
    const mask = options.mask?.map((f) => locateField(this.page, f));
    // only when given: an explicit `undefined` would replace the configured tolerance with none
    const compare = { mask, ...(options.maxDiffRatio !== undefined && { maxDiffPixelRatio: options.maxDiffRatio }) };
    await step(`Verify ${options.field ? `"${options.field.label}"` : 'page'} looks like "${name}"`, () =>
      options.field
        ? this.expect(locateField(this.page, options.field)).toHaveScreenshot(`${name}.png`, compare)
        : this.expect(this.page).toHaveScreenshot(`${name}.png`, { ...compare, fullPage: options.fullPage }),
    );
  }

  /**
   * Check the last page load against the performance budget (app.config.ts `checks.performance`,
   * overridden by `budget`). Use right after `open()`; timings are attached to the report.
   */
  async performance(budget: PerformanceBudget = {}): Promise<PageLoadMetrics> {
    return step('Verify page load is within the performance budget', () => checkPerformance(this.page, budget));
  }
}
