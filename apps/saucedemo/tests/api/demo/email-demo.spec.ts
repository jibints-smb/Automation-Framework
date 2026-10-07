/**
 * Email testing practice: a demo sender plays "the app" (apps/saucedemo/demo/demoAppMailer.ts), the tests read
 * the real test mailbox exactly as they would for a real website's signup / OTP emails.
 * Test cases: test-cases/api/email-demo.testcases.md
 *
 * Run: npm run demo:email   (needs MAIL_USER / MAIL_PASSWORD; tagged @demo, so no other run includes it)
 */
import { expect, test } from '@apps/saucedemo/fixtures';
import { demoAppSendsCode, demoAppSendsLink, demoAppVerifies, DemoShop } from '@apps/saucedemo/demo/demoAppMailer';
import { storyInfo } from '@core/utils/allure';

const firstName = 'Anna';

/** A wrong code of the same length: the real code with its last digit changed. */
const otherCode = (code: string) => code.slice(0, -1) + ((Number(code.at(-1)) + 1) % 10);

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

  // TC-MAILDEMO-05 to 09: what the app answers when a code is entered. Like a real test, they only use the code
  // read from the email; demoAppVerifies plays the app's verify screen / API.

  test('TC-MAILDEMO-05 | Correct code from the email is accepted', { tag: ['@demo', '@TC-MAILDEMO-05'] }, async ({ mailbox }) => {
    const email = mailbox.newAddress('valid');
    await demoAppSendsCode(email, firstName);
    const code = await mailbox.otpFrom(await mailbox.waitForEmail(email, { subject: 'verification code' }));

    expect(demoAppVerifies(email, code)).toBe('Verified');
  });

  test('TC-MAILDEMO-06 | Wrong code is rejected', { tag: ['@demo', '@TC-MAILDEMO-06'] }, async ({ mailbox }) => {
    const email = mailbox.newAddress('wrong');
    await demoAppSendsCode(email, firstName);
    const code = await mailbox.otpFrom(await mailbox.waitForEmail(email, { subject: 'verification code' }));

    expect(demoAppVerifies(email, otherCode(code))).toBe('Invalid code');
  });

  test('TC-MAILDEMO-07 | Old code no longer works after resend', { tag: ['@demo', '@TC-MAILDEMO-07'] }, async ({ mailbox }) => {
    const email = mailbox.newAddress('old');
    await demoAppSendsCode(email, firstName);
    const first = await mailbox.waitForEmail(email, { subject: 'verification code' });
    const firstCode = await mailbox.otpFrom(first);

    await demoAppSendsCode(email, firstName); // "Resend code"
    const secondCode = await mailbox.otpFrom(await mailbox.waitForEmail(email, { subject: 'verification code', newerThan: first }));

    expect(demoAppVerifies(email, firstCode)).toBe('Invalid code');
    expect(demoAppVerifies(email, secondCode)).toBe('Verified');
  });

  test('TC-MAILDEMO-08 | Code can be used only once', { tag: ['@demo', '@TC-MAILDEMO-08'] }, async ({ mailbox }) => {
    const email = mailbox.newAddress('reuse');
    await demoAppSendsCode(email, firstName);
    const code = await mailbox.otpFrom(await mailbox.waitForEmail(email, { subject: 'verification code' }));

    expect(demoAppVerifies(email, code)).toBe('Verified');
    expect(demoAppVerifies(email, code)).toBe('Code already used');
  });

  test('TC-MAILDEMO-09 | Expired code is rejected', { tag: ['@demo', '@TC-MAILDEMO-09'] }, async ({ mailbox }) => {
    // A real app needs a short QA expiry setting (or a fixed QA code) for this; never wait minutes with a sleep.
    const email = mailbox.newAddress('expired');
    await demoAppSendsCode(email, firstName, { expiresInSeconds: 0 });
    const code = await mailbox.otpFrom(await mailbox.waitForEmail(email, { subject: 'verification code' }));

    expect(demoAppVerifies(email, code)).toBe('Code expired');
  });
});
