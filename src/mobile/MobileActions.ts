import { isInputField, isSensitive, type FieldMap, type FormData, type MobileField, type MobileLocator } from '@core/models/field.types';
import { mask, step } from '@core/utils/step';
import type { Platform } from './capabilities';
import type { MobileDriver } from './driver';
import { resolveSelector } from './selector';

const WAIT_MS = 15_000;

/**
 * Reusable user actions for native mobile screens (Android & iOS).
 * Same idea as `WebActions`: every action is a named report step.
 */
export class MobileActions {
  constructor(
    private readonly driver: MobileDriver,
    readonly platform: Platform,
  ) {}

  /** Get the WebdriverIO element for a field, waiting until it is displayed. */
  async element(field: MobileField) {
    const el = this.driver.$(resolveSelector(field.locator, this.platform));
    await el.waitForDisplayed({ timeout: WAIT_MS, timeoutMsg: `"${field.label}" was not displayed` });
    return el;
  }

  async tap(field: MobileField): Promise<void> {
    await step(`Tap "${field.label}"`, async () => (await this.element(field)).click());
  }

  async type(field: MobileField, value: string): Promise<void> {
    const shown = mask(value, isSensitive(field));
    await step(`Type "${shown}" in "${field.label}"`, async () => {
      const el = await this.element(field);
      await el.clearValue();
      await el.setValue(value);
    });
  }

  async setSwitch(field: MobileField, on: boolean): Promise<void> {
    await step(`Turn ${on ? 'on' : 'off'} "${field.label}"`, async () => {
      const el = await this.element(field);
      const current = (await el.getAttribute(this.platform === 'android' ? 'checked' : 'value')) ?? '';
      const isOn = current === 'true' || current === '1';
      if (isOn !== on) await el.click();
    });
  }

  /** Open a picker/dropdown and tap the option with the given text. */
  async choose(field: MobileField, option: string): Promise<void> {
    await step(`Choose "${option}" in "${field.label}"`, async () => {
      await (await this.element(field)).click();
      await this.tap({ label: option, type: 'button', locator: { text: option } });
    });
  }

  async getText(field: MobileField): Promise<string> {
    return step(`Read text of "${field.label}"`, async () => (await (await this.element(field)).getText()).trim());
  }

  async isDisplayed(field: MobileField): Promise<boolean> {
    return this.driver.$(resolveSelector(field.locator, this.platform)).isDisplayed();
  }

  async swipe(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    await step(`Swipe ${direction}`, () => this.driver.swipe({ direction }));
  }

  /**
   * Swipe until the field is on screen. Needed for long lists (React Native `FlatList`, RecyclerView, ...):
   * rows that are off screen aren't in the element tree until they are scrolled to.
   * `direction` is the finger movement: 'up' reveals content further down. `within` limits the swipe to a
   * scrollable container (default: the screen's first scroll view).
   */
  async scrollTo(
    field: MobileField,
    { direction = 'up', within, maxSwipes = 10 }: { direction?: 'up' | 'down' | 'left' | 'right'; within?: MobileField; maxSwipes?: number } = {},
  ): Promise<void> {
    await step(`Scroll to "${field.label}"`, async () => {
      const scrollableElement = within ? await this.element(within) : undefined;
      for (let swipes = 0; !(await this.isDisplayed(field)); swipes++) {
        if (swipes === maxSwipes) throw new Error(`"${field.label}" not found after ${maxSwipes} swipes ${direction}`);
        await this.driver.swipe({ direction, percent: 0.5, scrollableElement });
      }
    });
  }

  async hideKeyboard(): Promise<void> {
    if (await this.driver.isKeyboardShown()) await this.driver.hideKeyboard();
  }

  async back(): Promise<void> {
    await step('Press back', () => this.driver.back());
  }

  /** Fill a single field, choosing the right action from its `type`. */
  async setValue(field: MobileField, value: string | boolean | string[]): Promise<void> {
    switch (field.type) {
      case 'checkbox':
        return this.setSwitch(field, Boolean(value));
      case 'dropdown':
      case 'radio':
        return this.choose(field, String(value));
      default:
        return this.type(field, String(value));
    }
  }

  /** Fill every field of a model that has a value in `data`, in model order. */
  async fillForm<M extends FieldMap<MobileLocator>>(model: M, data: FormData<M>): Promise<void> {
    const values = data as Record<string, string | boolean | string[] | undefined>;
    for (const [key, field] of Object.entries(model)) {
      const value = values[key];
      if (value === undefined || !isInputField(field)) continue;
      await this.setValue(field, value);
    }
    await this.hideKeyboard();
  }
}
