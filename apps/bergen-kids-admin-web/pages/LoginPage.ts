import { step } from '@core/utils/step';
import { AppPage } from '@apps/bergen-kids-admin-web/pages/AppPage';
import {
  LoginFields,
  LoginMessages,
  REMEMBERED_LOGIN_KEY,
  type LoginData,
} from '@apps/bergen-kids-admin-web/models/web/login.model';

export class LoginPage extends AppPage {
  readonly path = '/auth/login';
  readonly fields = LoginFields;

  /** Fill the form (fields left out of `data` stay as they are) and click "Sign in to dashboard". */
  async login(data: LoginData): Promise<void> {
    await step(`Sign in as "${data.email ?? ''}"`, async () => {
      await this.act.fillForm(this.fields, data);
      await this.act.click(this.fields.signInButton);
    });
  }

  /** Fill the form and press Enter in the Password field. */
  async loginWithEnter(data: LoginData): Promise<void> {
    await step(`Sign in as "${data.email ?? ''}" with Enter`, async () => {
      await this.act.fillForm(this.fields, data);
      await this.act.press(this.fields.password, 'Enter');
    });
  }

  async expectLoaded(): Promise<void> {
    await this.verify.url(/\/auth\/login/);
    await this.verify.visible(this.fields.heading);
  }

  /** TC-LOGIN-01: every text, field and control of the form. */
  async expectAllControls(): Promise<void> {
    await this.verify.title(LoginMessages.pageTitle);
    await this.verify.visible(this.fields.heading);
    await this.verify.visible(this.fields.subheading);
    await this.verify.attribute(this.fields.email, 'placeholder', 'Enter your email');
    await this.verify.attribute(this.fields.password, 'placeholder', 'Enter your password');
    await this.verify.visible(this.fields.showPassword);
    await this.verify.visible(this.fields.keepSignedIn);
    await this.verify.visible(this.fields.forgotLink);
    await this.verify.visible(this.fields.signInButton);
  }

  /** Field errors under Email / Password; a field left out must show no error. */
  async expectFieldErrors(errors: { email?: string; password?: string }): Promise<void> {
    if (errors.email) await this.verify.text(this.fields.emailError, errors.email);
    else await this.verify.hidden(this.fields.emailError);
    if (errors.password) await this.verify.text(this.fields.passwordError, errors.password);
    else await this.verify.hidden(this.fields.passwordError);
  }

  /** Toasts close after about 2.6 s: call right after the action. */
  async expectToast(text: string): Promise<void> {
    await this.verify.containsText(this.fields.toast, text);
  }

  /** One check for title and text: the toast may close before a second check runs. */
  async expectWelcomeToast(): Promise<void> {
    await this.verify.containsText(this.fields.toast, LoginMessages.welcomeToast);
  }

  /** Login was refused: still on the login page and the button can be used again. */
  async expectNotSignedIn(): Promise<void> {
    await this.verify.url(/\/auth\/login/);
    await this.verify.enabled(this.fields.signInButton);
  }

  async expectFilledWith(data: { email: string; password: string }): Promise<void> {
    await this.verify.value(this.fields.email, data.email);
    await this.verify.value(this.fields.password, data.password);
  }

  async expectEmpty(): Promise<void> {
    await this.verify.value(this.fields.email, '');
    await this.verify.value(this.fields.password, '');
  }

  async expectRememberedLogin(saved = true): Promise<void> {
    await this.verify.storedItem(REMEMBERED_LOGIN_KEY, saved);
  }

  async showPassword(): Promise<void> {
    await this.act.click(this.fields.showPassword);
  }

  async hidePassword(): Promise<void> {
    await this.act.click(this.fields.hidePassword);
  }

  /** Masked: input type "password" and the eye button offers "Show password". */
  async expectPasswordMasked(masked = true): Promise<void> {
    await this.verify.attribute(this.fields.password, 'type', masked ? 'password' : 'text');
    await this.verify.visible(masked ? this.fields.showPassword : this.fields.hidePassword);
  }

  async expectKeepSignedIn(checked = true): Promise<void> {
    await this.verify.checked(this.fields.keepSignedIn, checked);
  }

  async openForgotPassword(): Promise<void> {
    await this.act.click(this.fields.forgotLink);
  }

  async toggleTheme(): Promise<void> {
    await this.act.click(this.fields.themeToggle);
  }

  async expectTheme(theme: 'light' | 'dark'): Promise<void> {
    await this.verify.attribute(this.fields.pageRoot, 'data-theme', theme);
  }

  async clearSiteData(): Promise<void> {
    await this.act.clearSiteData();
  }
}
