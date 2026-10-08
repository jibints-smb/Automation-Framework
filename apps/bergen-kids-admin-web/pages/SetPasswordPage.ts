import { step } from '@core/utils/step';
import {
  ForgotPasswordMessages,
  PasswordRules,
  RuleColour,
  SetPasswordDynamicFields,
  SetPasswordFields,
  type PasswordRule,
  type SetPasswordData,
} from '@apps/bergen-kids-admin-web/models/web/forgot-password.model';
import { AppPage } from '@apps/bergen-kids-admin-web/pages/AppPage';

type RuleState = 'grey' | 'green' | 'red';

/**
 * Screen 3 of forgot password: choose the new password.
 * Submitting two matching valid passwords CHANGES the only admin's password: tests here never do that.
 */
export class SetPasswordPage extends AppPage {
  readonly path = '/auth/set-password';
  readonly fields = SetPasswordFields;

  async expectLoaded(): Promise<void> {
    await this.verify.url(/\/auth\/set-password\?sessionid=/);
    await this.verify.visible(this.fields.heading);
  }

  /** TC-FP-24: texts, fields, eye toggles, all 5 rules grey; New password has focus. */
  async expectAllControls(): Promise<void> {
    await this.verify.title(ForgotPasswordMessages.setPasswordTitle);
    await this.verify.visible(this.fields.heading);
    await this.verify.visible(this.fields.subheading);
    await this.verify.focused(this.fields.newPassword);
    await this.verify.attribute(this.fields.newPassword, 'placeholder', 'At least 8 characters');
    await this.verify.attribute(this.fields.confirmPassword, 'placeholder', 'Re-enter the new password');
    await this.verify.visible(this.fields.showNewPassword);
    await this.verify.visible(this.fields.showConfirmPassword);
    await this.verify.count(this.fields.rules, Object.keys(PasswordRules).length);
    for (const rule of Object.keys(PasswordRules) as PasswordRule[]) await this.expectRule(rule, 'grey');
    await this.verify.visible(this.fields.setButton);
    await this.verify.visible(this.fields.backLink);
  }

  /** Fill the fields given (others stay as they are); does not submit. */
  async fill(data: SetPasswordData): Promise<void> {
    await this.act.fillForm(this.fields, data);
  }

  /**
   * Fill and click "Set password". Refuses two matching passwords: that would reset the only admin's password.
   */
  async submit(data: SetPasswordData = {}): Promise<void> {
    if (data.newPassword && data.newPassword === data.confirmPassword) {
      throw new Error('SetPasswordPage.submit: matching passwords would reset the Super Admin password; not allowed in tests');
    }
    await step('Submit the new password', async () => {
      await this.fill(data);
      await this.act.click(this.fields.setButton);
    });
  }

  /** grey = not met, green = met (tick, "— met" for screen readers), red = not met after a failed submit. */
  async expectRule(rule: PasswordRule, state: RuleState): Promise<void> {
    const field = SetPasswordDynamicFields.rule(rule);
    await this.verify.attribute(field, 'class', RuleColour[state]);
    await this.verify.containsText(field, state === 'green' ? '— met' : '— not met yet');
  }

  /** Errors under the fields; a field left out must show no error. */
  async expectFieldErrors(errors: { newPassword?: string; confirmPassword?: string }): Promise<void> {
    if (errors.newPassword) await this.verify.text(this.fields.newPasswordError, errors.newPassword);
    else await this.verify.hidden(this.fields.newPasswordError);
    if (errors.confirmPassword) await this.verify.text(this.fields.confirmPasswordError, errors.confirmPassword);
    else await this.verify.hidden(this.fields.confirmPasswordError);
    await this.verify.url(/\/auth\/set-password/);
  }

  async expectMismatchError(): Promise<void> {
    await this.verify.visible(this.fields.mismatchError);
    await this.verify.url(/\/auth\/set-password/);
  }

  async expectPasswordsMatchHint(): Promise<void> {
    await this.verify.text(this.fields.matchHint, ForgotPasswordMessages.passwordsMatch);
    await this.verify.attribute(this.fields.matchHint, 'class', RuleColour.green);
  }

  async toggleNewPassword(): Promise<void> {
    await this.act.click(this.fields.showNewPassword);
  }

  async toggleConfirmPassword(): Promise<void> {
    await this.act.click(this.fields.showConfirmPassword);
  }

  /** Which of the two fields show their text (true) or are masked (false). */
  async expectVisibility(visible: { newPassword: boolean; confirmPassword: boolean }): Promise<void> {
    await this.verify.attribute(this.fields.newPassword, 'type', visible.newPassword ? 'text' : 'password');
    await this.verify.attribute(this.fields.confirmPassword, 'type', visible.confirmPassword ? 'text' : 'password');
  }

  async expectValues(data: { newPassword: string; confirmPassword: string }): Promise<void> {
    await this.verify.value(this.fields.newPassword, data.newPassword);
    await this.verify.value(this.fields.confirmPassword, data.confirmPassword);
  }

  async backToSignIn(): Promise<void> {
    await this.act.click(this.fields.backLink);
  }
}
