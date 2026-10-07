import type { Locator, Page } from '@playwright/test';
import { isInputField, type FieldMap, type FormData, type WebField, type WebLocator } from '@core/models/field.types';
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
    const shown = mask(value, field.type === 'password');
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

  /** Click a field that starts a download; returns the downloaded file's path. */
  async download(field: WebField): Promise<string> {
    return step(`Download via "${field.label}"`, async () => {
      const [download] = await Promise.all([this.page.waitForEvent('download'), this.locate(field).click()]);
      return download.path();
    });
  }

  async press(field: WebField, key: string): Promise<void> {
    await step(`Press "${key}" in "${field.label}"`, () => this.locate(field).press(key));
  }

  async hover(field: WebField): Promise<void> {
    await step(`Hover "${field.label}"`, () => this.locate(field).hover());
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
