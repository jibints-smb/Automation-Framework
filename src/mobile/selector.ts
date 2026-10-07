import type { MobileLocator, MobileSelector } from '@core/models/field.types';
import type { Platform } from './capabilities';

/** Turn a model's `MobileLocator` into a WebdriverIO selector string for the current platform. */
export function resolveSelector(locator: MobileLocator, platform: Platform): string {
  const selector: MobileSelector = 'android' in locator ? locator[platform] : locator;

  if ('accessibilityId' in selector) return `~${selector.accessibilityId}`;
  if ('id' in selector) return platform === 'android' ? `id=${selector.id}` : `~${selector.id}`;
  if ('text' in selector) {
    return platform === 'android'
      ? `android=new UiSelector().text("${selector.text}")`
      : `-ios predicate string:label == "${selector.text}" OR value == "${selector.text}"`;
  }
  if ('androidUiAutomator' in selector) return `android=${selector.androidUiAutomator}`;
  if ('iosPredicate' in selector) return `-ios predicate string:${selector.iosPredicate}`;
  if ('iosClassChain' in selector) return `-ios class chain:${selector.iosClassChain}`;
  return selector.xpath;
}
