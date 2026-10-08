// Runs one of the /qa-* Claude commands from the terminal, through the Claude Code CLI.
//
//   npm run qa:testcases -- apps/<app>/requirements/web/<file>.md
//   npm run qa:automate  -- apps/<app>/test-cases/web/<file>.testcases.md
//   npm run qa:fix       -- [spec path | @tag]
//   npm run qa:update    -- apps/<app>/requirements/web/<file>.md
//   npm run qa:merge     -- apps/<app>/sprints/sprint-NN/from-dev/<date>/<file>.md
//   node scripts/claude-cmd.mjs check   is Claude reachable from here? (QA Studio → Setup → System check)
//
// Options (after the path):  --chat     open an interactive Claude session instead of a one-shot run
//                            --dry-run  print the command without running it
// Needs the Claude Code CLI, signed in. Found on PATH, or in ~/.local/bin (the native installer's folder),
// or at CLAUDE_BIN. The same commands work in the VS Code Claude panel: /qa-testcases <file>.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const COMMANDS = {
  'qa-testcases': { needsArg: true, hint: 'apps/<app>/requirements/web/<file>.md' },
  'qa-automate': { needsArg: true, hint: 'apps/<app>/test-cases/web/<file>.testcases.md' },
  'qa-update': { needsArg: true, hint: 'apps/<app>/requirements/web/<file>.md' },
  'qa-fix': { needsArg: false, hint: '[spec path | @tag]' },
  'qa-merge': { needsArg: true, hint: 'apps/<app>/sprints/sprint-NN/from-dev/<date>/<file>.md' },
};
// One-shot runs can't stop to ask, so these are allowed up front: file edits (permission mode), the browser tool,
// and the commands the /qa-* instructions run. Anything else is refused and Claude reports it.
// QA decisions stay with QA: approving screenshots, signing off (req-track refuses it under an AI assistant),
// creating apps and pushing are never allowed here.
const ALLOWED_TOOLS = [
  'mcp__playwright',
  'Bash(npx tsc:*)',
  'Bash(npx playwright test:*)',
  'Bash(npm run test:*)',
  'Bash(npm run coverage:tc:*)',
  'Bash(npm run trace:check:*)',
  'Bash(npm run req:status:*)',
  'Bash(npm run req:diff:*)',
  'Bash(npm run req:baseline:*)',
  'Bash(npm run sprint:report:*)',
  'Bash(npm run typecheck:*)',
];
const DISALLOWED_TOOLS = [
  'Bash(npx playwright test --update-snapshots:*)',
  'Bash(npm run visual:update:*)',
  'Bash(npm run new:app:*)',
  'Bash(git push:*)',
];

const [command, ...rest] = process.argv.slice(2);

// Behind a company proxy that inspects HTTPS, Claude needs the company's root certificate (from IT):
// NODE_EXTRA_CA_CERTS in the root .env (QA Studio → Setup) is passed on to Claude.
const rootEnv = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const companyCa = process.env.NODE_EXTRA_CA_CERTS || rootEnv.match(/^NODE_EXTRA_CA_CERTS=(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, '');
const childEnv = { ...process.env, ...(companyCa ? { NODE_EXTRA_CA_CERTS: companyCa } : {}) };

if (command === 'check') {
  const claudeBin = findClaude();
  const viaShell = /\.(cmd|bat)$/i.test(claudeBin);
  const args = ['-p', 'Reply with just the word OK'];
  const run = spawnSync(viaShell ? quote(claudeBin) : claudeBin, viaShell ? args.map(quote) : args, {
    encoding: 'utf8',
    shell: viaShell,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });
  const out = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim();
  if (run.status === 0 && /\bOK\b/.test(out)) {
    console.log(`Claude is reachable (${claudeBin}).`);
    process.exit(0);
  }
  console.log(out || `Claude did not answer (${run.error?.message ?? `exit code ${run.status}`}).`);
  process.exit(1);
}
const chat = rest.includes('--chat');
const dryRun = rest.includes('--dry-run');
const args = rest.filter((a) => a !== '--chat' && a !== '--dry-run');
const spec = COMMANDS[command];

if (!spec) fail(`Unknown command "${command}". Use one of: ${Object.keys(COMMANDS).join(', ')}`);
if (spec.needsArg && !args.length) fail(`Usage: npm run ${command.replace('-', ':')} -- ${spec.hint}`);
for (const arg of args) {
  if (!arg.startsWith('@') && /[\\/]/.test(arg) && !fs.existsSync(arg)) {
    fail(`File not found: ${arg}\nRun from the framework's root folder and give the path from there.`);
  }
}

const prompt = `/${command}${args.length ? ` ${args.join(' ')}` : ''}`;
const claudeArgs = chat
  ? [prompt]
  : ['-p', prompt, '--permission-mode', 'acceptEdits', '--allowedTools', ...ALLOWED_TOOLS, '--disallowedTools', ...DISALLOWED_TOOLS];
const claude = findClaude();

if (dryRun) {
  console.log([claude, ...claudeArgs].map(quote).join(' '));
  process.exit(0);
}
console.log(chat ? `Opening Claude: ${prompt}` : `Running ${prompt}\nThis can take several minutes; Claude prints its summary when it is done.\n`);

// .cmd launchers (npm-installed CLI on Windows) only start through a shell; quote the arguments for it.
const viaShell = /\.(cmd|bat)$/i.test(claude);
const child = spawn(viaShell ? quote(claude) : claude, viaShell ? claudeArgs.map(quote) : claudeArgs, {
  // one-shot runs read nothing from the keyboard (otherwise Claude waits for input first)
  stdio: chat ? 'inherit' : ['ignore', 'inherit', 'inherit'],
  shell: viaShell,
  env: childEnv,
});
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => fail(`Could not start Claude (${claude}): ${error.message}`));

/** The Claude CLI: CLAUDE_BIN, then PATH, then the native installer's folder. */
function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const found = spawnSync(finder, ['claude'], { encoding: 'utf8' });
  const onPath = found.status === 0 ? found.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  const preferred = onPath.find((p) => /\.(exe|cmd)$/i.test(p)) ?? onPath[0];
  if (preferred) return preferred;
  const local = path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  if (fs.existsSync(local)) return local;
  fail(
    'Claude Code CLI not found. Install it (PowerShell: irm https://claude.ai/install.ps1 | iex), sign in once by ' +
      'running "claude", or set CLAUDE_BIN to its full path. Or use the same command in the VS Code Claude panel.',
  );
}

function quote(value) {
  return /[\s"&|<>^()]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
