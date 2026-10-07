import { BaseScreen } from '@core/mobile/BaseScreen';
import { MobileHomeFields } from '@apps/saucedemo/models/mobile/home.model';

export class HomeScreen extends BaseScreen {
  readonly fields = MobileHomeFields;

  async expectLoaded(): Promise<void> {
    await this.verify.visible(this.fields.welcomeTitle);
  }
}
