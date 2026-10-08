import { app } from '@core/config/app';
import { env } from '@core/config/env';

export type Platform = 'android' | 'ios';

/** Values can be nested objects for device clouds, e.g. 'bstack:options': { userName, buildName }. */
type Capabilities = Record<string, unknown>;

/** Drop empty values so Appium doesn't receive blank capabilities. */
function compact(caps: Record<string, string | number | boolean | undefined>): Capabilities {
  return Object.fromEntries(Object.entries(caps).filter(([, v]) => v !== undefined && v !== '')) as Capabilities;
}

/**
 * Appium capabilities per platform: defaults from `.env`, plus the app's `mobile.capabilities`.
 * Returns `null` when the app under test isn't configured, so mobile tests skip cleanly.
 */
export function getCapabilities(platform: Platform): Capabilities | null {
  const defaults = defaultCapabilities(platform);
  return defaults && { ...defaults, ...app.mobile?.capabilities?.[platform] };
}

function defaultCapabilities(platform: Platform): Capabilities | null {
  if (platform === 'android') {
    const a = env.mobile.android;
    if (!a.app && !a.appPackage) return null;
    return compact({
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': a.deviceName,
      'appium:platformVersion': a.platformVersion,
      'appium:app': a.app,
      'appium:appPackage': a.appPackage,
      'appium:appActivity': a.appActivity,
      'appium:autoGrantPermissions': true,
      'appium:newCommandTimeout': 240,
    });
  }

  const i = env.mobile.ios;
  if (!i.app && !i.bundleId) return null;
  return compact({
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': i.deviceName,
    'appium:platformVersion': i.platformVersion,
    'appium:app': i.app,
    'appium:bundleId': i.bundleId,
    'appium:autoAcceptAlerts': true,
    'appium:newCommandTimeout': 240,
  });
}
