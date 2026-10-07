import { expect, type Page } from '@playwright/test';
import type { WebField } from '@core/models/field.types';
import type { PerformanceBudget } from '@core/config/app';
import { step } from '@core/utils/step';
import { checkAccessibility, type AccessibilityOptions } from './accessibility';
import { locateField } from './locator';
import { checkPerformance, type PageLoadMetrics } from './performance';

/**
 * Readable, auto-waiting assertions on model fields.
 * Each check is a named report step, e.g. `Verify "Error message" has text "..."`.
 */
export class WebAssertions {
  constructor(private readonly page: Page) {}

  async visible(field: WebField): Promise<void> {
    await step(`Verify "${field.label}" is visible`, () => expect(locateField(this.page, field)).toBeVisible());
  }

  async hidden(field: WebField): Promise<void> {
    await step(`Verify "${field.label}" is hidden`, () => expect(locateField(this.page, field)).toBeHidden());
  }

  async text(field: WebField, expected: string | RegExp): Promise<void> {
    await step(`Verify "${field.label}" has text "${expected}"`, () =>
      expect(locateField(this.page, field)).toHaveText(expected),
    );
  }

  async containsText(field: WebField, expected: string | RegExp): Promise<void> {
    await step(`Verify "${field.label}" contains "${expected}"`, () =>
      expect(locateField(this.page, field)).toContainText(expected),
    );
  }

  async value(field: WebField, expected: string | RegExp): Promise<void> {
    await step(`Verify "${field.label}" has value "${expected}"`, () =>
      expect(locateField(this.page, field)).toHaveValue(expected),
    );
  }

  async count(field: WebField, expected: number): Promise<void> {
    await step(`Verify ${expected} x "${field.label}"`, () =>
      expect(locateField(this.page, field)).toHaveCount(expected),
    );
  }

  async enabled(field: WebField, enabled = true): Promise<void> {
    await step(`Verify "${field.label}" is ${enabled ? 'enabled' : 'disabled'}`, () =>
      enabled
        ? expect(locateField(this.page, field)).toBeEnabled()
        : expect(locateField(this.page, field)).toBeDisabled(),
    );
  }

  async checked(field: WebField, checked = true): Promise<void> {
    await step(`Verify "${field.label}" is ${checked ? 'checked' : 'unchecked'}`, () =>
      expect(locateField(this.page, field)).toBeChecked({ checked }),
    );
  }

  async url(expected: string | RegExp): Promise<void> {
    await step(`Verify URL matches "${expected}"`, () => expect(this.page).toHaveURL(expected));
  }

  async title(expected: string | RegExp): Promise<void> {
    await step(`Verify page title "${expected}"`, () => expect(this.page).toHaveTitle(expected));
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
    const compare = { mask, maxDiffPixelRatio: options.maxDiffRatio };
    await step(`Verify ${options.field ? `"${options.field.label}"` : 'page'} looks like "${name}"`, () =>
      options.field
        ? expect(locateField(this.page, options.field)).toHaveScreenshot(`${name}.png`, compare)
        : expect(this.page).toHaveScreenshot(`${name}.png`, { ...compare, fullPage: options.fullPage }),
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
