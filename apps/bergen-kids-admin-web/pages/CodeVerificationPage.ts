import { step } from '@core/utils/step';
import { CodeVerificationFields, ForgotPasswordMessages } from '@apps/bergen-kids-admin-web/models/web/forgot-password.model';
import { AppPage } from '@apps/bergen-kids-admin-web/pages/AppPage';

/** Screen 2 of forgot password: enter the code; it is checked as soon as the last digit is in. */
export class CodeVerificationPage extends AppPage {
  readonly path = '/auth/code-verification';
  readonly fields = CodeVerificationFields;

  async expectLoaded(): Promise<void> {
    await this.verify.url(/\/auth\/code-verification\?sessionid=.+&email=/);
    await this.verify.visible(this.fields.heading);
  }

  /** TC-FP-09: texts and controls; the code input has focus. */
  async expectAllControls(email: string, codeLength: number): Promise<void> {
    await this.verify.title(ForgotPasswordMessages.codePageTitle);
    await this.verify.visible(this.fields.heading);
    await this.verify.text(this.fields.subtext, ForgotPasswordMessages.codeSentTo(email, codeLength));
    await this.verify.attribute(this.fields.code, 'maxlength', String(codeLength));
    await this.verify.focused(this.fields.code);
    await this.verify.visible(this.fields.resendButton);
    await this.verify.text(this.fields.countdown, /^\s*in \d+s$/);
    await this.verify.visible(this.fields.backLink);
  }

  /** Put the whole code in at once (like pasting it). */
  async enterCode(code: string): Promise<void> {
    await this.act.fill(this.fields.code, code);
  }

  /** Type key by key (letters, symbols and spaces must be refused). */
  async typeKeys(keys: string[]): Promise<void> {
    await step(`Type ${keys.map((k) => `"${k}"`).join(', ')} in the code`, async () => {
      for (const key of keys) await this.act.press(this.fields.code, key);
    });
  }

  async expectCode(value: string | RegExp): Promise<void> {
    await this.verify.value(this.fields.code, value);
  }

  /** "Verifying…" shows while the code is checked. Call right after entering the last digit. */
  async expectVerifying(): Promise<void> {
    await this.verify.visible(this.fields.verifying);
  }

  /** Not checked: no "Verifying…", no error, still on this screen. */
  async expectNotChecked(): Promise<void> {
    await this.verify.hidden(this.fields.verifying);
    await this.verify.hidden(this.fields.codeError);
    await this.verify.url(/\/auth\/code-verification/);
  }

  /** Wrong code: error, boxes cleared, first box focused, still on this screen. */
  async expectCodeRejected(message: string): Promise<void> {
    await this.verify.text(this.fields.codeError, message);
    await this.expectCode('');
    await this.verify.focused(this.fields.code);
    await this.verify.url(/\/auth\/code-verification/);
  }

  async expectResendWaiting(seconds: number): Promise<void> {
    await this.verify.enabled(this.fields.resendButton, false);
    await this.verify.text(this.fields.countdown, new RegExp(`^\\s*in ${seconds}s$`));
  }

  async expectResendReady(): Promise<void> {
    await this.verify.enabled(this.fields.resendButton);
    await this.verify.hidden(this.fields.countdown);
  }

  /**
   * Wait (real time) until "Resend code" is enabled. The server also refuses resends less than 30 s apart,
   * so a fast-forwarded clock is not enough between two resends.
   */
  async waitUntilResendReady(): Promise<void> {
    await this.verify.enabled(this.fields.resendButton, true, { timeout: 40_000 });
  }

  async resend(): Promise<void> {
    await this.act.click(this.fields.resendButton);
  }

  /** The button reads "Sending…" while the request runs. Call right after `resend`. */
  async expectResending(): Promise<void> {
    await this.verify.visible(this.fields.resendingButton);
  }

  async expectResendToast(email: string, codeLength: number): Promise<void> {
    await this.verify.containsText(this.fields.toast, ForgotPasswordMessages.resendToast(email, codeLength));
  }

  async back(): Promise<void> {
    await this.act.click(this.fields.backLink);
  }
}
