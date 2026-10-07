/**
 * Email testing practice: a demo sender plays "the app" (apps/saucedemo/demo/demoAppMailer.ts), the tests read
 * the real test mailbox exactly as they would for a real website's signup / OTP emails.
 * Test cases: test-cases/api/email-demo.testcases.md
 *
 * Run: npm run demo:email   (needs MAIL_USER / MAIL_PASSWORD; tagged @demo, so no other run includes it)
 */
import { expect, test } from '@apps/saucedemo/fixtures';
import { demoAppSendsCode, demoAppSendsLink, DemoShop } from '@apps/saucedemo/demo/demoAppMailer';
import { storyInfo } from '@core/utils/allure';

const firstName = 'Anna';

test.describe('Email testing demo', () => {
  test.beforeEach(async () => {
    await storyInfo({ epic: 'Platform', feature: 'Email testing demo', story: 'Practise email tests on the test mailbox' });
  });

  test('TC-MAILDEMO-01 | Verification email arrives with the right content', { tag: ['@demo', '@TC-MAILDEMO-01'] }, async ({ mailbox }) => {
    const email = mailbox.newAddress('signup');
    await demoAppSendsCode(email, firstName);

    const message = await mailbox.waitForEmail(email, { subject: 'verification code' });
    expect(message.from).toContain(DemoShop.name);
    expect(message.subject).toBe(DemoShop.codeSubject);
    expect(message.to).toContain(email);
    expect(message.text).toContain(`Hi ${firstName}`);
    expect(message.text).not.toMatch(/{{|}}|\bundefined\b|\bnull\b/);
  });

  test('TC-MAILDEMO-02 | One-time code is read from the email', { tag: ['@demo', '@TC-MAILDEMO-02'] }, async ({ mailbox }) => {
    const email = mailbox.newAddress('signup');
    const sent = await demoAppSendsCode(email, firstName);

    const message = await mailbox.waitForEmail(email, { subject: 'verification code' });
    expect(await mailbox.otpFrom(message)).toBe(sent);
  });

  test('TC-MAILDEMO-03 | Resend: the newest code is read', { tag: ['@demo', '@TC-MAILDEMO-03'] }, async ({ mailbox }) => {
    const email = mailbox.newAddress('resend');
    await demoAppSendsCode(email, firstName);
    const first = await mailbox.waitForEmail(email, { subject: 'verification code' });
    const firstCode = await mailbox.otpFrom(first);

    const resent = await demoAppSendsCode(email, firstName);
    const second = await mailbox.waitForEmail(email, { subject: 'verification code', newerThan: first });
    const secondCode = await mailbox.otpFrom(second);
    expect(secondCode).toBe(resent);
    expect(secondCode).not.toBe(firstCode);
  });

  test('TC-MAILDEMO-04 | Confirmation link is read from the email', { tag: ['@demo', '@TC-MAILDEMO-04'] }, async ({ mailbox }) => {
    const email = mailbox.newAddress('confirm');
    const sent = await demoAppSendsLink(email, firstName);

    const message = await mailbox.waitForEmail(email, { subject: 'Confirm your' });
    expect(await mailbox.linkFrom(message, '/verify-email')).toBe(sent);
  });
});
