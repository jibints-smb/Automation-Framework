import { remote } from 'webdriverio';
import { env } from '@core/config/env';

export type MobileDriver = WebdriverIO.Browser;

/** Start an Appium session with the given capabilities. */
export async function createDriver(capabilities: Record<string, unknown>): Promise<MobileDriver> {
  const url = new URL(env.mobile.appiumUrl);
  try {
    return await remote({
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: Number(url.port || 4723),
      path: url.pathname === '' ? '/' : url.pathname,
      // device clouds (BrowserStack, Sauce Labs): APPIUM_URL=https://<user>:<key>@hub.browserstack.com/wd/hub
      ...(url.username ? { user: decodeURIComponent(url.username), key: decodeURIComponent(url.password) } : {}),
      logLevel: 'warn',
      capabilities,
    });
  } catch (error) {
    throw new Error(
      `Could not start an Appium session at ${url.host}${url.pathname}. ` +
        'Check that `appium` is running, the device/emulator is connected (`adb devices`), and the app path in .env is correct.',
      { cause: error },
    );
  }
}
