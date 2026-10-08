/**
 * Field models describe the UI fields of a screen/page as plain data:
 * what the field is called, what kind of control it is, how to find it,
 * and the business rules for it (taken from the story / module MD file).
 *
 * Pages and screens never hard-code locators — they read them from a model.
 */
import type { Page } from '@playwright/test';

export type FieldType =
  // inputs (can be filled by fillForm)
  | 'text'
  | 'password'
  | 'email'
  | 'number'
  | 'textarea'
  | 'date'
  | 'dropdown'
  | 'checkbox'
  | 'radio'
  | 'file'
  // non-inputs (clicked or read only)
  | 'button'
  | 'link'
  | 'label';

type AriaRole = Parameters<Page['getByRole']>[0];

/** How to find a field in a web page. Prefer the options at the top of the list. */
export type WebLocator =
  | { testId: string }
  | { role: AriaRole; name?: string | RegExp; exact?: boolean }
  | { label: string | RegExp; exact?: boolean }
  | { placeholder: string | RegExp; exact?: boolean }
  | { text: string | RegExp; exact?: boolean }
  | { css: string }
  | { xpath: string };

/** How to find a field in a native mobile app (Appium). */
export type MobileSelector =
  | { accessibilityId: string }
  | { id: string }
  | { text: string }
  | { androidUiAutomator: string }
  | { iosPredicate: string }
  | { iosClassChain: string }
  | { xpath: string };

/** One selector for both platforms, or a separate selector per platform. */
export type MobileLocator = MobileSelector | { android: MobileSelector; ios: MobileSelector };

export interface FieldRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  /** Allowed options for dropdown / radio fields. */
  options?: readonly string[];
  /** Expected validation messages, keyed by rule (e.g. `required`, `pattern`). */
  messages?: Partial<Record<'required' | 'minLength' | 'maxLength' | 'pattern' | 'invalid', string>>;
}

export interface Field<L> {
  /** Human readable name — shown in report steps, e.g. `Fill "Username"`. */
  label: string;
  type: FieldType;
  locator: L;
  rules?: FieldRules;
  /**
   * Custom dropdowns only: how to find one option in the open list.
   * Default (web): an element with role "option" and that exact name; (mobile): that exact text.
   * @example option: (value) => ({ css: `.menu-item:text-is("${value}")` })
   */
  option?: (value: string) => L;
  /** Web only: CSS selector of the iframe that contains this field (payment widgets, embedded editors). */
  frame?: string;
  /** Mask the value in reports (OTP, PIN, card number, security answer). Password fields always are. */
  sensitive?: boolean;
  /**
   * Web only: find this field inside another one (a table row, a card, a dialog) instead of the whole page.
   * With `hasText` on the parent this replaces most CSS/XPath, e.g. the Delete button of one row:
   * @example deleteIn: (name: string) => ({ ...Users.deleteButton, within: { ...Users.row, hasText: name } })
   */
  within?: Field<L>;
  /** Web only: keep only the matches that contain this text. */
  hasText?: string | RegExp;
  /** Web only: when several elements match, use this one (0 = first, -1 = last). */
  nth?: number;
}

export type WebField = Field<WebLocator>;
export type MobileField = Field<MobileLocator>;
export type FieldMap<L> = Record<string, Field<L>>;

/** Field types whose value is a boolean. */
type BooleanFieldType = 'checkbox';
/** Field types that cannot be filled. */
type ActionFieldType = 'button' | 'link' | 'label';

type ValueFor<F> = F extends { type: BooleanFieldType }
  ? boolean
  : F extends { type: 'file' }
    ? string | string[]
    : string;

/**
 * The data shape for a model, derived automatically from its fields.
 * Buttons/links/labels are excluded; checkboxes are booleans; the rest are strings.
 *
 * @example type LoginData = FormData<typeof LoginFields>; // { username?: string; password?: string }
 */
export type FormData<M> = {
  [K in keyof M as M[K] extends { type: ActionFieldType } ? never : K]?: ValueFor<M[K]>;
};

/** Declare a web model. Keeps field types literal so `FormData` can be derived. */
export function defineWebFields<const M extends FieldMap<WebLocator>>(fields: M): M {
  return fields;
}

/** Declare a mobile model. Keeps field types literal so `FormData` can be derived. */
export function defineMobileFields<const M extends FieldMap<MobileLocator>>(fields: M): M {
  return fields;
}

/** True when the field's value must not appear in reports. */
export function isSensitive(field: Field<unknown>): boolean {
  return field.type === 'password' || field.sensitive === true;
}

/** Field types that hold a value and can be filled by `fillForm`. */
export function isInputField(field: Field<unknown>): boolean {
  return !['button', 'link', 'label'].includes(field.type);
}
