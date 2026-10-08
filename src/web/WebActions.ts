import { expect, test, type Locator, type Page, type Response, type Route } from '@playwright/test';
import { isInputField, isSensitive, type FieldMap, type FormData, type WebField, type WebLocator } from '@core/models/field.types';
import { mask, step } from '@core/utils/step';
import { locateField, resolveLocator } from './locator';

export interface MockResponse {
  status?: number;
  /** Response body as JSON. */
  json?: unknown;
  /** Raw response body (when not JSON). */
  body?: string;
  headers?: Record<string, string>;
}

/**
 * Reusable user actions for web pages.
 * Every action is a named report step, e.g. `Fill "Username" with "standard_user"`.
 * Works with plain HTML controls and with UI-library components (custom dropdowns, date pickers, iframes).
 */
export class WebActions {
  constructor(private readonly page: Page) {}

  /** Get the Playwright locator for a field (for anything not covered below). */
  locate(field: WebField): Locator {
    return locateField(this.page, field);
  }

  async goto(path: string): Promise<void> {
    await step(`Open "${path}"`, () => this.page.goto(path).then(() => undefined));
  }

  async click(field: WebField): Promise<void> {
    await step(`Click "${field.label}"`, () => this.locate(field).click());
  }

  async fill(field: WebField, value: string): Promise<void> {
    const shown = mask(value, isSensitive(field));
    await step(`Fill "${field.label}" with "${shown}"`, () => this.locate(field).fill(value));
  }

  async clear(field: WebField): Promise<void> {
    await step(`Clear "${field.label}"`, () => this.locate(field).clear());
  }

  /**
   * Choose option(s) in a dropdown. Native `<select>` elements use the browser's select;
   * custom dropdowns (MUI, Ant Design, React-Select, ...) are opened and the option is clicked.
   */
  async select(field: WebField, option: string | string[]): Promise<void> {
    const options = Array.isArray(option) ? option : [option];
    await step(`Select "${options.join(', ')}" in "${field.label}"`, async () => {
      const dropdown = this.locate(field);
      const isNative = await dropdown.evaluate((el) => el.tagName === 'SELECT');
      if (isNative) {
        await dropdown.selectOption(options);
        return;
      }
      for (const value of options) {
        await dropdown.click();
        await this.optionOf(field, value).click();
      }
    });
  }

  /**
   * Set a date. Native `<input type="date">` needs `YYYY-MM-DD`; custom date pickers get the text
   * typed in the format the app shows (from the module MD), then the picker is closed with Tab.
   */
  async setDate(field: WebField, value: string): Promise<void> {
    await step(`Set "${field.label}" to "${value}"`, async () => {
      const input = this.locate(field);
      if (await input.evaluate((el) => (el as HTMLInputElement).readOnly)) {
        // read-only date pickers (open a calendar on click): set the value the way the picker would
        await input.evaluate((el, v) => {
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
          set.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, value);
        return;
      }
      await input.fill(value);
      if ((await input.getAttribute('type')) !== 'date') await input.press('Tab');
    });
  }

  async check(field: WebField, checked = true): Promise<void> {
    await step(`${checked ? 'Check' : 'Uncheck'} "${field.label}"`, () => this.locate(field).setChecked(checked));
  }

  /** Radio fields point at the group; the option is picked inside it by its label. */
  async chooseRadio(field: WebField, option: string): Promise<void> {
    await step(`Choose "${option}" in "${field.label}"`, () =>
      this.locate(field).getByRole('radio', { name: option, exact: true }).check(),
    );
  }

  async upload(field: WebField, files: string | string[]): Promise<void> {
    await step(`Upload "${files}" to "${field.label}"`, () => this.locate(field).setInputFiles(files));
  }

  /**
   * Click a field that starts a download; returns the path of the saved file (in the test's output folder,
   * kept after the browser closes) and attaches it to the report.
   */
  async download(field: WebField): Promise<string> {
    return step(`Download via "${field.label}"`, async () => {
      const [download] = await Promise.all([this.page.waitForEvent('download'), this.locate(field).click()]);
      const file = test.info().outputPath(download.suggestedFilename());
      await download.saveAs(file);
      await test.info().attach(`Download: ${download.suggestedFilename()}`, { path: file });
      return file;
    });
  }

  /**
   * Click and wait for the server's answer to the request it sends (save, search, delete), so the next step
   * sees the result. Returns the response; fails when it doesn't come or has another status than `status`.
   * @example const res = await this.act.clickAndWaitForResponse(F.save, /\/api\/users/, { status: 201 });
   */
  async clickAndWaitForResponse(field: WebField, url: string | RegExp, options: { status?: number; method?: string } = {}): Promise<Response> {
    return step(`Click "${field.label}" and wait for ${options.method ?? ''} ${url}`.replace(/  +/g, ' '), async () => {
      const matches = (res: Response) =>
        (typeof url === 'string' ? res.url().includes(url) : url.test(res.url())) &&
        (!options.method || res.request().method() === options.method.toUpperCase());
      const [response] = await Promise.all([this.page.waitForResponse(matches), this.locate(field).click()]);
      if (options.status !== undefined && response.status() !== options.status) {
        throw new Error(`${response.request().method()} ${response.url()} returned ${response.status()} (expected ${options.status})`);
      }
      return response;
    });
  }

  /**
   * Click a link or button that opens a new tab/window; returns that page (wrap it in its page object:
   * `new InvoicePage(await this.act.openInNewTab(F.viewInvoice))`).
   */
  async openInNewTab(field: WebField): Promise<Page> {
    return step(`Open "${field.label}" in a new tab`, async () => {
      const [popup] = await Promise.all([this.page.context().waitForEvent('page'), this.locate(field).click()]);
      await popup.waitForLoadState();
      return popup;
    });
  }

  async dragTo(source: WebField, target: WebField): Promise<void> {
    await step(`Drag "${source.label}" to "${target.label}"`, () => this.locate(source).dragTo(this.locate(target)));
  }

  /**
   * Wait until a loading indicator (spinner, splash, overlay) is gone, with a longer limit than a normal check:
   * slow environments show it for a while. Use before acting on a page that loads data.
   */
  async waitUntilGone(field: WebField, timeoutMs = 30_000): Promise<void> {
    await step(`Wait until "${field.label}" is gone`, () => expect(this.locate(field)).toBeHidden({ timeout: timeoutMs }));
  }

  async press(field: WebField, key: string): Promise<void> {
    await step(`Press "${key}" in "${field.label}"`, () => this.locate(field).press(key));
  }

  async hover(field: WebField): Promise<void> {
    await step(`Hover "${field.label}"`, () => this.locate(field).hover());
  }

  /** Clear the current site's localStorage and sessionStorage, like "Clear site data" in the browser (cookies stay). */
  async clearSiteData(): Promise<void> {
    await step('Clear site data (localStorage, sessionStorage)', () =>
      this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      }),
    );
  }

  /**
   * Take control of the page's clock (timers, Date) so countdowns can be tested without waiting.
   * Call before opening the page; time keeps running until `pauseClock()`.
   */
  async installClock(): Promise<void> {
    await step('Install a controllable clock', () => this.page.clock.install());
  }

  /**
   * Stop the page's clock (a second from now: it can't move backwards); timers only move on with `fastForward()`.
   * Needs `installClock()` first.
   */
  async pauseClock(): Promise<void> {
    await step('Pause the clock', () => this.page.clock.pauseAt(Date.now() + 1_000));
  }

  /** Move the page's clock forward, firing every timer due on the way (e.g. a 30 s resend countdown). */
  async fastForward(ms: number): Promise<void> {
    await step(`Fast-forward the clock ${ms / 1000} s`, () => this.page.clock.runFor(ms));
  }

  /** Accept (or dismiss) the next browser dialog (alert / confirm / prompt) triggered by the following action. */
  async handleNextDialog(accept = true, promptText?: string): Promise<void> {
    this.page.once('dialog', (dialog) => (accept ? dialog.accept(promptText) : dialog.dismiss()));
  }

  async getText(field: WebField): Promise<string> {
    return step(`Read text of "${field.label}"`, async () => (await this.locate(field).innerText()).trim());
  }

  /** Texts of every element matching the field. Waits for at least one, so an unrendered list fails instead of returning []. */
  async getAllTexts(field: WebField): Promise<string[]> {
    return step(`Read all texts of "${field.label}"`, async () => {
      const items = this.locate(field);
      await items.first().waitFor({ state: 'visible' });
      return (await items.allInnerTexts()).map((t) => t.trim());
    });
  }

  async isVisible(field: WebField): Promise<boolean> {
    return this.locate(field).isVisible();
  }

  /**
   * Replace the response of matching API calls for this page, e.g. to test error or empty states.
   * Call it before the action that triggers the request.
   *
   * @example await act.mockApi(/\/api\/v1\/customers$/, { status: 500, json: { error: 'boom' } });
   */
  async mockApi(url: string | RegExp, response: MockResponse): Promise<void> {
    await step(`Mock API ${url} → ${response.status ?? 200}`, () =>
      this.page.route(url, (route) =>
        route.fulfill({
          status: response.status ?? 200,
          headers: response.headers,
          ...(response.json !== undefined ? { json: response.json } : { body: response.body ?? '' }),
        }),
      ),
    );
  }

  /**
   * Keep matching requests waiting until `release()` is called, to check a short loading state ("Sending…",
   * button disabled) without racing the server. Other methods pass through.
   *
   * @example const release = await act.holdRequests(/\/auth\/login/);
   *          await act.click(signIn); await verify.visible(signingIn); await release();
   */
  async holdRequests(url: string | RegExp, method = 'POST'): Promise<() => Promise<void>> {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const held: Promise<void>[] = [];
    const handler = (route: Route) => {
      if (route.request().method() !== method) return route.fallback();
      const passed = gate.then(() => route.continue());
      held.push(passed);
      return passed;
    };
    await step(`Hold ${method} requests to ${url}`, () => this.page.route(url, handler));
    return () =>
      step(`Release ${method} requests to ${url}`, async () => {
        open();
        await Promise.all(held); // let the held requests go before removing the route
        await this.page.unroute(url, handler);
      });
  }

  /** Fill a single field, choosing the right action from its `type`. */
  async setValue(field: WebField, value: string | boolean | string[]): Promise<void> {
    switch (field.type) {
      case 'checkbox':
        return this.check(field, Boolean(value));
      case 'radio':
        return this.chooseRadio(field, String(value));
      case 'dropdown':
        return this.select(field, value as string | string[]);
      case 'date':
        return this.setDate(field, String(value));
      case 'file':
        return this.upload(field, value as string | string[]);
      default:
        return this.fill(field, String(value));
    }
  }

  /**
   * Fill every field of a model that has a value in `data`, in model order.
   * Fields missing from `data` are skipped, which makes negative tests easy.
   *
   * @example await act.fillForm(LoginFields, { username: 'bob', password: 'secret' });
   */
  async fillForm<M extends FieldMap<WebLocator>>(model: M, data: FormData<M>): Promise<void> {
    const values = data as Record<string, string | boolean | string[] | undefined>;
    for (const [key, field] of Object.entries(model)) {
      const value = values[key];
      if (value === undefined || !isInputField(field)) continue;
      await this.setValue(field, value);
    }
  }

  /** An option of an open custom dropdown. Lists usually render at page level, outside any iframe. */
  private optionOf(field: WebField, value: string): Locator {
    return field.option
      ? resolveLocator(this.page, field.option(value))
      : this.page.getByRole('option', { name: value, exact: true });
  }
}
