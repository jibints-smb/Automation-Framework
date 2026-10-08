import { step } from '@core/utils/step';
import { DashboardFields } from '@apps/bergen-kids-admin-web/models/web/dashboard.model';
import { AppPage } from '@apps/bergen-kids-admin-web/pages/AppPage';

export class DashboardPage extends AppPage {
  readonly path = '/';
  readonly fields = DashboardFields;

  async expectLoaded(): Promise<void> {
    await this.verify.url(/^https?:\/\/[^/]+\/$/); // the site root, on any environment
    await this.verify.visible(this.fields.heading);
    await this.expectSplashGone();
  }

  /** Account menu → "Sign out" → confirm "Sign out?" dialog; ends on the login page. */
  async signOut(): Promise<void> {
    await step('Sign out', async () => {
      await this.act.click(this.fields.accountMenu);
      await this.act.click(this.fields.signOut);
      await this.act.click(this.fields.confirmSignOut);
      await this.verify.url(/\/auth\/login/);
    });
  }
}
