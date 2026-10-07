// Checks the test mailbox settings (MAIL_* in apps/<app>/.env) before tests rely on them.
// Usage: npm run mail:check [-- <app>]
// Logs in over IMAP, shows the folders the tests will search and a sample test address. Never prints the password.
import path from 'node:path';
import dotenv from 'dotenv';
import { ImapFlow } from 'imapflow';
import { resolveApp } from './lib.mjs';

const { app, appDir } = resolveApp(process.argv[2]);
const testEnv = process.env.TEST_ENV ?? 'qa';
// same order as src/config/env.ts: real environment, .env.<TEST_ENV>, app .env, root .env
dotenv.config({ path: [path.join(appDir, `.env.${testEnv}`), path.join(appDir, '.env'), '.env'], quiet: true });

const user = process.env.MAIL_USER ?? '';
const pass = process.env.MAIL_PASSWORD ?? '';
const host = process.env.MAIL_IMAP_HOST || 'imap.gmail.com';
const port = Number(process.env.MAIL_IMAP_PORT || 993);

console.log(`\nTest mailbox for "${app}" (${testEnv})`);
if (!user.includes('@') || !pass) {
  console.error(`  MAIL_USER (full address) and MAIL_PASSWORD (app password) must be set in ${appDir}/.env`);
  process.exit(1);
}
console.log(`  Account:  ${user} on ${host}:${port}`);

const client = new ImapFlow({ host, port, secure: port === 993, auth: { user, pass }, logger: false });
try {
  await client.connect();
} catch (error) {
  console.error(`  Login FAILED: ${error.message}`);
  console.error('  Gmail: turn on 2-step verification, create an app password (Google Account → Security → App passwords),');
  console.error('  put it in MAIL_PASSWORD; IMAP is on by default. Outlook: MAIL_IMAP_HOST=outlook.office365.com and an app password.');
  process.exit(1);
}

const folders = await client.list();
const spam = folders.find((f) => f.specialUse === '\\Junk')?.path;
const allMail = folders.find((f) => f.specialUse === '\\All')?.path;
const trash = folders.find((f) => f.specialUse === '\\Trash')?.path;
const inbox = await client.status('INBOX', { messages: true });
await client.logout();

const [name, domain] = user.split('@');
console.log('  Login:    OK');
console.log(`  Searches: INBOX (${inbox.messages} emails)${spam ? `, ${spam}` : ', no spam folder found'}${allMail ? `, ${allMail}` : ''}`);
console.log(`  Cleanup:  ${trash ? `moves test emails to ${trash}` : 'deletes test emails (no trash folder found)'}`);
console.log(`  Example test address: ${name}+${process.env.TEST_DATA_PREFIX || 'qa-auto'}-signup-<id>@${domain}`);
console.log('\nReady: use the `mailbox` fixture in tests (see src/mail/Mailbox.ts).\n');
