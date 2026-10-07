import type { Page } from '@playwright/test';
import { WebActions } from './WebActions';
import { WebAssertions } from './WebAssertions';

/**
 * Parent of every page object.
 *  - `act`    → user actions   (click, fill, fillForm, ...)
 *  - `verify` → assertions     (visible, text, url, ...)
 *  - `path`   → URL of the page relative to BASE_URL
 */
export abstract class BasePage {
  abstract readonly path: string;
  readonly act: WebActions;
  readonly verify: WebAssertions;

  constructor(readonly page: Page) {
    this.act = new WebActions(page);
    this.verify = new WebAssertions(page);
  }

  async open(): Promise<void> {
    await this.act.goto(this.path);
  }
}
