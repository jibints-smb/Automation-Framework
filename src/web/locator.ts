import type { FrameLocator, Locator, Page } from '@playwright/test';
import type { WebField, WebLocator } from '@core/models/field.types';

/** Turn a model's `WebLocator` into a Playwright `Locator`, inside a page, an iframe or another element. */
export function resolveLocator(root: Page | FrameLocator | Locator, locator: WebLocator): Locator {
  if ('testId' in locator) return root.getByTestId(locator.testId);
  if ('role' in locator) return root.getByRole(locator.role, { name: locator.name, exact: locator.exact });
  if ('label' in locator) return root.getByLabel(locator.label, { exact: locator.exact });
  if ('placeholder' in locator) return root.getByPlaceholder(locator.placeholder, { exact: locator.exact });
  if ('text' in locator) return root.getByText(locator.text, { exact: locator.exact });
  if ('css' in locator) return root.locator(locator.css);
  return root.locator(`xpath=${locator.xpath}`);
}

/**
 * Locator for a model field: inside its parent field (`within`) or iframe (`frame`), narrowed by `hasText`
 * and `nth` when the model sets them.
 */
export function locateField(page: Page, field: WebField): Locator {
  const root = field.within ? locateField(page, field.within) : field.frame ? page.frameLocator(field.frame) : page;
  let locator = resolveLocator(root, field.locator);
  if (field.hasText !== undefined) locator = locator.filter({ hasText: field.hasText });
  if (field.nth !== undefined) locator = field.nth === -1 ? locator.last() : locator.nth(field.nth);
  return locator;
}
