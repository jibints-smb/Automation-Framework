// System check: everything a QA machine needs, with a button to fix what can be fixed from here.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readEnv } from '../envfile.mjs';
import { appInfo, currentContext } from '../context.mjs';
import { startJob } from '../jobs.mjs';

const PLAYWRIGHT = 'node_modules/@playwright/test/cli.js';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', timeout: 20_000 });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

/** Browsers Playwright needs, and whether they are installed (install --dry-run prints where they go). */
function browsers() {
  const r = spawnSync(process.execPath, [PLAYWRIGHT, 'install', '--dry-run', 'chromium', 'webkit'], { encoding: 'utf8', timeout: 20_000 });
  // "Chrome for Testing 153.0 (playwright chromium v1243)\n  Install location:    C:\...\chromium-1243"
  return [...(r.stdout ?? '').matchAll(/^.+?\(playwright ([\w-]+) v\d+\)\s*\r?\n\s*Install location:\s*(.+?)\s*$/gm)]
    .filter((m) => ['chromium', 'webkit'].includes(m[1]))
    .map((m) => ({ name: m[1] === 'webkit' ? 'webkit (Safari, iPhone)' : 'chromium (Chrome, Edge)', installed: fs.existsSync(m[2]) }));
}

export const routes = [
  {
    method: 'GET',
    path: /^\/api\/system$/,
    handler: () => {
      const ctx = currentContext();
      const checks = [];
      const add = (name, status, detail, fix) => checks.push({ name, status, detail, fix });

      const major = Number(process.versions.node.split('.')[0]);
      add('Node.js', major >= 20 ? 'ok' : 'fail', `v${process.versions.node}${major >= 20 ? '' : ' (20 or newer needed)'}`);
      const git = run('git', ['--version']);
      add('Git', git.ok ? 'ok' : 'warn', git.ok ? git.out : 'Not found: needed to share work with the team');
      const claude = run('claude', ['--version']);
      add('Claude Code CLI', claude.ok ? 'ok' : 'warn', claude.ok ? claude.out.split('\n')[0] : 'Not found: needed for Generate test cases / Automate / Fix (install Claude Code)');
      if (claude.ok) add('Claude connection', 'info', 'Test whether Claude can reach its service from QA Studio', 'claude-check');
      for (const b of browsers()) {
        add(`Browser: ${b.name}`, b.installed ? 'ok' : 'fail', b.installed ? 'Installed' : 'Not installed', b.installed ? undefined : 'install-browsers');
      }
      add('Your settings (.env)', ctx.rootEnvExists ? 'ok' : 'fail', ctx.rootEnvExists ? 'Present' : 'Missing: open Setup and save', ctx.rootEnvExists ? undefined : 'setup');
      add('Your name (QA_NAME)', ctx.qaName ? 'ok' : 'warn', ctx.qaName || 'Not set: reports will show your git user name', ctx.qaName ? undefined : 'setup');

      if (!ctx.app) {
        add('Active app', 'fail', 'No app selected (Setup) or no app exists (Apps → New app)', 'setup');
      } else {
        const info = appInfo(ctx.app);
        add('Active app', 'ok', `${info.name} (${ctx.app})`);
        const envFile = path.join('apps', ctx.app, ctx.environment === 'qa' ? '.env' : `.env.${ctx.environment}`);
        const hasEnv = fs.existsSync(envFile);
        add(`App settings (${path.basename(envFile)})`, hasEnv ? 'ok' : 'fail', hasEnv ? 'Present' : `Missing for environment "${ctx.environment}"`, hasEnv ? undefined : 'app-settings');
        if (hasEnv && info.roles.length) {
          const values = new Map(readEnv(envFile).concat(readEnv(path.join('apps', ctx.app, '.env'))).map((e) => [e.key, e]));
          const missing = info.roles.flatMap((r) => [r.usernameEnv, r.passwordEnv]).filter((k) => !values.get(k)?.set);
          add('Login accounts', missing.length ? 'fail' : 'ok', missing.length ? `Not set: ${missing.join(', ')}` : info.roles.map((r) => r.role).join(', '), missing.length ? 'app-settings' : undefined);
          const login = path.join('.auth', ctx.app, ctx.environment, `${info.defaultRole || info.roles[0].role}.json`);
          const age = fs.existsSync(login) ? Math.round((Date.now() - fs.statSync(login).mtimeMs) / 3_600_000) : undefined;
          add('Saved login', age === undefined ? 'warn' : 'ok', age === undefined ? 'Not saved yet (made automatically before the tests)' : `Saved ${age} h ago`, 'refresh-logins');
        }
        const mail = readEnv(path.join('apps', ctx.app, '.env')).find((e) => e.key === 'MAIL_USER');
        add('Test mailbox', mail?.set ? 'ok' : 'info', mail?.set ? mail.value : 'Not configured (only needed for email / OTP tests)', mail?.set ? 'mail-check' : undefined);
      }
      return { checks };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/system\/(?<action>[\w-]+)$/,
    handler: ({ params }) => {
      const by = currentContext().qaName;
      if (params.action === 'install-browsers') {
        return startJob({ kind: 'system', title: 'Install browsers', args: [PLAYWRIGHT, 'install', 'chromium', 'webkit'], by });
      }
      if (params.action === 'refresh-logins') {
        return startJob({ kind: 'test', title: 'Refresh saved logins', args: [PLAYWRIGHT, 'test', '--project=setup'], by });
      }
      if (params.action === 'claude-check') {
        return startJob({ kind: 'system', title: 'Claude connection test', args: ['scripts/claude-cmd.mjs', 'check'], by });
      }
      if (params.action === 'mail-check') {
        return startJob({ kind: 'system', title: 'Check the test mailbox', args: ['scripts/mail-check.mjs'], by });
      }
      throw Object.assign(new Error(`Unknown action ${params.action}`), { status: 400 });
    },
  },
];
