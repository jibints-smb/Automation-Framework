import type { Platform } from './capabilities';
import type { MobileDriver } from './driver';
import { MobileActions } from './MobileActions';
import { MobileAssertions } from './MobileAssertions';

/**
 * Parent of every mobile screen object (the mobile version of `BasePage`).
 *  - `act`    → user actions (tap, type, fillForm, swipe, ...)
 *  - `verify` → assertions   (visible, text, ...)
 */
export abstract class BaseScreen {
  readonly act: MobileActions;
  readonly verify: MobileAssertions;

  constructor(
    readonly driver: MobileDriver,
    readonly platform: Platform,
  ) {
    this.act = new MobileActions(driver, platform);
    this.verify = new MobileAssertions(this.act);
  }
}
