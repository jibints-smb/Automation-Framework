import type { FrameLocator, Locator, Page } from '@playwright/test';
import type { WebField, WebLocator } from '@core/models/field.types';

/** Turn a model's `WebLocator` into a Playwright `Locator`, inside a page or an iframe. */
export function resolveLocator(root: Page | FrameLocator, locator: WebLocator): Locator {
  if ('testId' in locator) return root.getByTestId(locator.testId);
  if ('role' in locator) return root.getByRole(locator.role, { name: locator.name, exact: locator.exact });
  if ('label' in locator) return root.getByLabel(locator.label, { exact: locator.exact });
  if ('placeholder' in locator) return root.getByPlaceholder(locator.placeholder, { exact: locator.exact });
  if ('text' in locator) return root.getByText(locator.text, { exact: locator.exact });
  if ('css' in locator) return root.locator(locator.css);
  return root.locator(`xpath=${locator.xpath}`);
}

/** Locator for a model field, taking its iframe (if any) into account. */
export function locateField(page: Page, field: WebField): Locator {
  const root = field.frame ? page.frameLocator(field.frame) : page;
  return resolveLocator(root, field.locator);
}
