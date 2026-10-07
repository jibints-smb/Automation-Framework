/**
 * DEMO ONLY: plays "the app" that sends emails, so email tests can be practised without a real website
 * (SauceDemo itself sends no email). Real apps send their own emails; tests then only use the `mailbox` fixture.
 *
 * Sends through the test mailbox's own SMTP server: Gmail smtp.gmail.com:465 with the same app password.
 * The emails look like real ones on purpose (other numbers, footer, links) to show the mailbox reads the right code.
 */
import nodemailer from 'nodemailer';
import { env, getEnv } from '@core/config/env';
import { randomDigits, uniqueId } from '@core/utils/random';
import { step } from '@core/utils/step';

export const DemoShop = {
  name: 'Demo Shop',
  codeSubject: 'Your Demo Shop verification code',
  linkSubject: 'Confirm your Demo Shop email address',
} as const;

function send(to: string, subject: string, html: string) {
  const port = Number(getEnv('MAIL_SMTP_PORT', '465'));
  const transport = nodemailer.createTransport({
    host: getEnv('MAIL_SMTP_HOST', 'smtp.gmail.com'),
    port,
    secure: port === 465,
    auth: { user: env.mail.user, pass: env.mail.password },
  });
  return transport.sendMail({ from: `"${DemoShop.name}" <${env.mail.user}>`, to, subject, html });
}

const layout = (body: string) => `<!doctype html><html><head><style>p{font-family:Arial}</style></head><body>
<h2>${DemoShop.name}</h2>${body}
<p style="color:#777">Support ticket 778899 · ${DemoShop.name}, 10115 Berlin · © ${new Date().getFullYear()}</p>
<p><a href="https://demo-shop.example/unsubscribe?u=1">Unsubscribe</a></p></body></html>`;

/** The demo app's answer when a code is entered: plays the messages a real verify screen or API shows. */
export type DemoVerifyResult = 'Verified' | 'Invalid code' | 'Code expired' | 'Code already used';

/** The demo app's own record of the last code per address (a real app keeps this in its database). */
const issuedCodes = new Map<string, { code: string; expiresAt: number; used: boolean }>();

/**
 * The demo app sends a signup verification code; returns the code it sent (a real test never knows it).
 * Sending again replaces the previous code, so the old one stops working, as in most real apps.
 */
export async function demoAppSendsCode(to: string, firstName: string, options: { expiresInSeconds?: number } = {}): Promise<string> {
  const expiresInSeconds = options.expiresInSeconds ?? 600;
  const code = randomDigits(6);
  const expiry = expiresInSeconds >= 60 ? `${Math.round(expiresInSeconds / 60)} minutes` : `${expiresInSeconds} seconds`;
  await step(`Demo app sends a verification code to ${to}`, () =>
    send(to, DemoShop.codeSubject, layout(`<p>Hi ${firstName},</p><p>Your verification code is <b>${code}</b>. It expires in ${expiry}.</p><p>Didn't sign up? Ignore this email.</p>`)),
  );
  issuedCodes.set(to, { code, expiresAt: Date.now() + expiresInSeconds * 1000, used: false });
  return code;
}

/** The user enters `code` for `to` in the demo app: what the app answers. A correct code works only once. */
export function demoAppVerifies(to: string, code: string): DemoVerifyResult {
  const issued = issuedCodes.get(to);
  if (!issued || issued.code !== code.trim()) return 'Invalid code';
  if (Date.now() >= issued.expiresAt) return 'Code expired';
  if (issued.used) return 'Code already used';
  issued.used = true;
  return 'Verified';
}

/** The demo app sends a "confirm your email" link; returns the link it sent. */
export async function demoAppSendsLink(to: string, firstName: string): Promise<string> {
  const link = `https://demo-shop.example/verify-email?token=${uniqueId()}`;
  await step(`Demo app sends a confirmation link to ${to}`, () =>
    send(to, DemoShop.linkSubject, layout(`<p>Hi ${firstName},</p><p><a href="${link}">Confirm my email address</a></p>`)),
  );
  return link;
}
