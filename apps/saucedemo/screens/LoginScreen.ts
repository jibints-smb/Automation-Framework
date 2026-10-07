import { BaseScreen } from '@core/mobile/BaseScreen';
import { MobileLoginFields, type MobileLoginData } from '@apps/saucedemo/models/mobile/login.model';
import { step } from '@core/utils/step';

export class LoginScreen extends BaseScreen {
  readonly fields = MobileLoginFields;

  async login(data: MobileLoginData): Promise<void> {
    await step(`Log in as "${data.username ?? ''}"`, async () => {
      await this.act.fillForm(this.fields, data);
      await this.act.tap(this.fields.loginButton);
    });
  }

  async expectError(message: string): Promise<void> {
    await this.verify.text(this.fields.errorMessage, message);
  }

  async expectLoaded(): Promise<void> {
    await this.verify.visible(this.fields.loginButton);
  }
}
