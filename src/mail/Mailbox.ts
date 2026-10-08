/**
 * Test mailbox for flows that send an email: signup OTP, verification links, password reset.
 * Reads a real mailbox over IMAP (default: a dedicated Gmail account, settings MAIL_* in the app .env).
 *
 * Every test gets its own address through "plus addressing": qa.mysite+qa-auto-signup-k3x9@gmail.com
 * arrives in qa.mysite@gmail.com, so the test finds exactly its own email. Emails sent to the addresses
 * of a test are moved to Trash after the test.
 *
 * @example
 *   const email = mailbox.newAddress('signup');
 *   await signupPage.register({ ...newUser, email });
 *   const message = await mailbox.waitForEmail(email, { subject: 'Verify' });
 *   await otpPage.enter(await mailbox.otpFrom(message));
 */
import { expect, test } from '@playwright/test';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { env, requireSettings } from '@core/config/env';
import { uniqueId } from '@core/utils/random';
import { redact } from '@core/utils/redact';
import { step } from '@core/utils/step';

export interface Email {
  to: string;
  from: string;
  subject: string;
  /** Plain text body (made from the HTML when the email has no text part). */
  text: string;
  html: string;
  date: Date;
  /** Where it was found; used to tell emails apart and to remove them after the test. */
  folder: string;
  uid: number;
}

export interface WaitForEmailOptions {
  /** Text the subject contains (case-insensitive), or a pattern. */
  subject?: string | RegExp;
  /** Only an email that arrived after this one, e.g. the second OTP after "Resend code". */
  newerThan?: Email;
  /** Default: MAIL_WAIT_SECONDS (60). */
  timeoutSeconds?: number;
}

const OTP_WORDS = 'code|otp|pin|passcode|password|verification|verify|one[- ]time';

export class Mailbox {
  private client?: ImapFlow;
  private folders?: { search: string[]; trash?: string };
  private readonly addresses: string[] = [];

  /** A new, unique address that arrives in the test mailbox. `label` shows what it is for (signup, reset, ...). */
  newAddress(label = 'user'): string {
    this.requireConfig();
    const [name, domain] = env.mail.user.split('@');
    const address = `${name}+${env.testData.prefix}-${label}-${uniqueId()}@${domain}`;
    this.addresses.push(address);
    return address;
  }

  /** Wait until an email to `to` arrives (inbox, spam, All Mail), and attach it to the report. Newest match wins. */
  async waitForEmail(to: string, options: WaitForEmailOptions = {}): Promise<Email> {
    const seconds = options.timeoutSeconds ?? env.mail.waitSeconds;
    const what = `email to ${to}${options.subject ? ` with subject "${options.subject}"` : ''}${options.newerThan ? ' (newer than the previous one)' : ''}`;
    return step(`Wait for ${what}`, async () => {
      let found: Email | undefined;
      await expect
        .poll(async () => (found = await this.find(to, options)), {
          message: `No ${what} arrived within ${seconds} s (inbox, spam and All Mail checked)`,
          timeout: seconds * 1000,
          intervals: [2000, 3000, 5000],
        })
        .toBeTruthy();
      await test.info().attach(`Email: ${found!.subject}`, {
        // token-like link parameters are masked here; the test itself reads the real email
        body: redact(`From: ${found!.from}\nTo: ${found!.to}\nDate: ${found!.date.toISOString()}\nSubject: ${found!.subject}\n\n${found!.text}`),
        contentType: 'text/plain',
      });
      return found!;
    });
  }

  /**
   * The one-time code in an email: the `length`-digit number next to a word like "code", "OTP" or
   * "verification", or the only `length`-digit number in it. Other formats (letters, dashes): pass `pattern`,
   * with the code in its first group, e.g. `/code: ([A-Z0-9]{8})/`.
   */
  async otpFrom(email: Email, options: { length?: number; pattern?: RegExp } = {}): Promise<string> {
    return step(`Read the one-time code from "${email.subject}"`, async () => {
      const text = email.text;
      if (options.pattern) {
        const match = text.match(options.pattern);
        if (!match) throw new Error(`No code matching ${options.pattern} in email "${email.subject}": ${preview(text)}`);
        return match[1] ?? match[0];
      }
      const length = options.length ?? 6;
      const nearWord = text.match(new RegExp(`(?:${OTP_WORDS})\\D{0,60}?\\b(\\d{${length}})\\b`, 'i'));
      if (nearWord) return nearWord[1];
      const numbers = [...new Set(text.match(new RegExp(`\\b\\d{${length}}\\b`, 'g')) ?? [])];
      if (numbers.length === 1) return numbers[0];
      throw new Error(
        numbers.length
          ? `Several ${length}-digit numbers in email "${email.subject}" (${numbers.join(', ')}), none next to a word like "code": pass { pattern }`
          : `No ${length}-digit code in email "${email.subject}": ${preview(text)}`,
      );
    });
  }

  /** The first link in an email whose address contains `contains` (e.g. "/verify"), for verification-link flows. */
  async linkFrom(email: Email, contains = ''): Promise<string> {
    return step(`Read the link${contains ? ` containing "${contains}"` : ''} from "${email.subject}"`, async () => {
      const links = [...email.html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => decodeEntities(m[1]));
      const plain = email.text.match(/https?:\/\/\S+/g) ?? [];
      const link = [...links, ...plain].find((l) => /^https?:/i.test(l) && l.includes(contains));
      if (!link) throw new Error(`No link${contains ? ` containing "${contains}"` : ''} in email "${email.subject}"`);
      return link;
    });
  }

  /** Run by the `mailbox` fixture after the test: moves this test's emails to Trash and logs out. */
  async close(): Promise<void> {
    const client = this.client;
    if (!client) return;
    try {
      await step('Cleanup: remove test emails', async () => {
        const { search, trash } = await this.mailFolders();
        for (const folder of search) {
          const lock = await client.getMailboxLock(folder);
          try {
            for (const to of this.addresses) {
              const uids = await client.search({ to }, { uid: true });
              if (!uids || !uids.length) continue;
              if (trash) await client.messageMove(uids, trash, { uid: true });
              else await client.messageDelete(uids, { uid: true });
            }
          } finally {
            lock.release();
          }
        }
      });
    } catch (error) {
      test.info().annotations.push({ type: 'warning', description: `Removing test emails failed: ${error}` });
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private async find(to: string, options: WaitForEmailOptions): Promise<Email | undefined> {
    const client = await this.connect();
    const emails: Email[] = [];
    for (const folder of (await this.mailFolders()).search) {
      const lock = await client.getMailboxLock(folder);
      try {
        const uids = await client.search({ to }, { uid: true });
        if (!uids || !uids.length) continue;
        for await (const message of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
          if (message.source) emails.push(await parse(message.source, folder, message.uid));
        }
      } finally {
        lock.release();
      }
    }
    const { subject, newerThan: prev } = options;
    return emails
      .filter((e) => !subject || (typeof subject === 'string' ? e.subject.toLowerCase().includes(subject.toLowerCase()) : subject.test(e.subject)))
      .filter((e) => !prev || (e.folder === prev.folder ? e.uid > prev.uid : e.date > prev.date))
      .sort((a, b) => b.date.getTime() - a.date.getTime() || b.uid - a.uid)[0];
  }

  private async connect(): Promise<ImapFlow> {
    if (this.client?.usable) return this.client;
    this.requireConfig();
    const { imapHost: host, imapPort: port } = env.mail;
    const client = new ImapFlow({ host, port, secure: port === 993, auth: { user: env.mail.user, pass: env.mail.password }, logger: false });
    try {
      await client.connect();
    } catch (error) {
      throw new Error(
        `Mail login failed for MAIL_USER on ${host}:${port}: ${(error as Error).message}. ` +
          'Gmail/Outlook need IMAP enabled and an app password (2-step verification on) in MAIL_PASSWORD.',
        { cause: error },
      );
    }
    this.client = client;
    return client;
  }

  /**
   * Folders to search: INBOX, spam and (Gmail) All Mail, which also holds mail the account sent to its own
   * + addresses; plus the trash folder for cleanup. Names differ per provider and language.
   */
  private async mailFolders(): Promise<{ search: string[]; trash?: string }> {
    if (!this.folders) {
      const list = await this.client!.list();
      const special = (use: string) => list.find((f) => f.specialUse === use)?.path;
      const extra = [special('\\Junk'), special('\\All')].filter((f): f is string => !!f);
      this.folders = { search: ['INBOX', ...extra], trash: special('\\Trash') };
    }
    return this.folders;
  }

  private requireConfig(): void {
    requireSettings({ MAIL_USER: env.mail.user, MAIL_PASSWORD: env.mail.password });
    if (!env.mail.user.includes('@')) throw new Error(`Missing setting: MAIL_USER must be the full email address of the test mailbox`);
  }
}

async function parse(source: Buffer, folder: string, uid: number): Promise<Email> {
  const mail = await simpleParser(source);
  const html = typeof mail.html === 'string' ? mail.html : '';
  const addresses = (field: typeof mail.to) => (Array.isArray(field) ? field : field ? [field] : []).map((a) => a.text).join(', ');
  return {
    to: addresses(mail.to),
    from: mail.from?.text ?? '',
    subject: mail.subject ?? '',
    text: (mail.text?.trim() || htmlToText(html)).replace(/[ \t]+/g, ' '),
    html,
    date: mail.date ?? new Date(0),
    folder,
    uid,
  };
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (all, code: string) =>
    code[0] === '#' ? String.fromCodePoint(parseInt(code.slice(code[1] === 'x' || code[1] === 'X' ? 2 : 1), code[1] === 'x' || code[1] === 'X' ? 16 : 10)) : (named[code.toLowerCase()] ?? all),
  );
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 200 ? `${flat.slice(0, 200)}...` : flat || '(empty email)';
}
