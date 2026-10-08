import { step } from '@core/utils/step';
import { ForgotPasswordFields, ForgotPasswordMessages } from '@apps/bergen-kids-admin-web/models/web/forgot-password.model';
import { AppPage } from '@apps/bergen-kids-admin-web/pages/AppPage';

/** Screen 1 of forgot password: enter the email, a code is sent. */
export class ForgotPasswordPage extends AppPage {
  readonly path = '/auth/forgot-password';
  readonly fields = ForgotPasswordFields;

  async expectLoaded(): Promise<void> {
    await this.verify.url(/\/auth\/forgot-password/);
    await this.verify.visible(this.fields.heading);
  }

  /** TC-FP-01: every text and control; the email field has focus. */
  async expectAllControls(): Promise<void> {
    await this.verify.title(ForgotPasswordMessages.pageTitle);
    await this.verify.visible(this.fields.eyebrow);
    await this.verify.visible(this.fields.heading);
    await this.verify.visible(this.fields.subheading);
    await this.verify.focused(this.fields.email);
    await this.verify.visible(this.fields.sendButton);
    await this.verify.visible(this.fields.backLink);
  }

  /** Fill the email (left as is when undefined) and click "Send verification code". */
  async sendCode(email?: string): Promise<void> {
    await step(`Send a verification code to "${email ?? ''}"`, async () => {
      if (email !== undefined) await this.act.fill(this.fields.email, email);
      await this.act.click(this.fields.sendButton);
    });
  }

  /** The button reads "Sending…" while the request runs. Call right after `sendCode`. */
  async expectSending(): Promise<void> {
    await this.verify.visible(this.fields.sendingButton);
  }

  async expectEmailError(message: string): Promise<void> {
    await this.verify.text(this.fields.emailError, message);
    await this.verify.url(/\/auth\/forgot-password/);
  }

  async expectBanner(message: string): Promise<void> {
    await this.verify.text(this.fields.banner, message);
    await this.verify.url(/\/auth\/forgot-password/);
  }

  async backToSignIn(): Promise<void> {
    await this.act.click(this.fields.backLink);
  }
}
