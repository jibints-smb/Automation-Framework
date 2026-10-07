import { expect } from '@playwright/test';
import type { MobileField } from '@core/models/field.types';
import { step } from '@core/utils/step';
import type { MobileActions } from './MobileActions';

const WAIT_MS = 15_000;

/** Readable, auto-waiting assertions on mobile model fields. */
export class MobileAssertions {
  constructor(private readonly act: MobileActions) {}

  async visible(field: MobileField): Promise<void> {
    await step(`Verify "${field.label}" is visible`, () =>
      expect.poll(() => this.act.isDisplayed(field), { timeout: WAIT_MS }).toBe(true),
    );
  }

  async hidden(field: MobileField): Promise<void> {
    await step(`Verify "${field.label}" is hidden`, () =>
      expect.poll(() => this.act.isDisplayed(field), { timeout: WAIT_MS }).toBe(false),
    );
  }

  async text(field: MobileField, expected: string | RegExp): Promise<void> {
    await step(`Verify "${field.label}" has text "${expected}"`, () =>
      expect
        .poll(async () => (await (await this.act.element(field)).getText()).trim(), { timeout: WAIT_MS })
        .toMatch(typeof expected === 'string' ? new RegExp(`^${escapeRegExp(expected)}$`) : expected),
    );
  }

  async containsText(field: MobileField, expected: string): Promise<void> {
    await step(`Verify "${field.label}" contains "${expected}"`, () =>
      expect
        .poll(async () => (await this.act.element(field)).getText(), { timeout: WAIT_MS })
        .toContain(expected),
    );
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
