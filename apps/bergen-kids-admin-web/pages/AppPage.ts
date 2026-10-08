import { BasePage } from '@core/web/BasePage';
import { AppShellFields } from '@apps/bergen-kids-admin-web/models/web/app-shell.model';

/** Parent of every Bergen Kids Admin page: opening a page waits for the loading splash to go. */
export abstract class AppPage extends BasePage {
  async open(): Promise<void> {
    await super.open();
    await this.expectSplashGone();
  }

  /** The splash can take over 10 s on staging: a wait with a longer limit, not a check of the app. */
  async expectSplashGone(): Promise<void> {
    await this.act.waitUntilGone(AppShellFields.splash);
  }
}
