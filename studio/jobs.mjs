// Runs the framework's commands for QA Studio as child processes and streams their output to the browser.
// Only the API modules create jobs, each from a fixed command with checked arguments (no free-form commands).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { envValue } from './envfile.mjs';

const require = createRequire(import.meta.url);
const { loadSecrets, redactText } = require('../src/report/redact.cjs');

const MAX_LINES = 5000;
const HISTORY_FILE = path.join('reports', '.studio-jobs.json');
/** Each finished job's (redacted) output, so QA Viewer and a restarted Studio can still show it. */
const LOG_DIR = path.join('reports', '.studio-jobs');
const RUN_LOCK = '.qa-run.lock';
let secrets = loadSecrets();

/** @type {Map<string, Job>} */
const jobs = new Map();
let counter = 0;

/**
 * @typedef {{ id: string, kind: string, title: string, command: string, status: 'running'|'passed'|'failed'|'stopped',
 *   startedAt: string, endedAt?: string, exitCode?: number|null, by: string, lines: string[], listeners: Set<Function>,
 *   child?: import('node:child_process').ChildProcess, meta?: object }} Job
 */

/** The run in progress on this machine (from the framework's lock), if any. */
export function activeTestRun() {
  try {
    const lock = JSON.parse(fs.readFileSync(RUN_LOCK, 'utf8'));
    process.kill(lock.pid, 0);
    return lock;
  } catch {
    return undefined;
  }
}

/**
 * Starts a job. `args` are passed to node (no shell) unless `npm` is given (fixed npm script names only).
 * kind 'test' jobs can't run in parallel with another test run (theirs or one from a terminal).
 */
export function startJob({ kind, title, args, npm, env = {}, by = '', meta = {} }) {
  if (kind === 'test') {
    const running = [...jobs.values()].find((j) => j.kind === 'test' && j.status === 'running');
    const lock = activeTestRun();
    if (running || lock) {
      throw Object.assign(new Error(`Another test run is in progress${lock ? ` (started ${lock.started})` : ''}. Wait for it or stop it first.`), { status: 409 });
    }
  }
  secrets = loadSecrets(); // settings may have changed since the last job
  const id = `${Date.now().toString(36)}-${++counter}`;
  const command = npm ? `npm run ${npm}` : `node ${args.join(' ')}`;
  const child = npm
    ? spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', npm], { cwd: process.cwd(), env: childEnv(env), shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
    : spawn(process.execPath, args, { cwd: process.cwd(), env: childEnv(env), stdio: ['ignore', 'pipe', 'pipe'] });
  /** @type {Job} */
  const job = { id, kind, title, command: redactText(command, secrets), status: 'running', startedAt: new Date().toISOString(), by, lines: [], listeners: new Set(), child, meta };
  jobs.set(id, job);

  let partial = { stdout: '', stderr: '' };
  const onData = (stream) => (chunk) => {
    const text = partial[stream] + chunk.toString('utf8').replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
    const parts = text.split(/\r?\n/);
    partial[stream] = parts.pop() ?? '';
    for (const line of parts) push(job, line);
  };
  child.stdout?.on('data', onData('stdout'));
  child.stderr?.on('data', onData('stderr'));
  child.on('error', (error) => push(job, `Could not start: ${error.message}`));
  child.on('close', (code) => {
    for (const rest of Object.values(partial)) if (rest) push(job, rest);
    job.exitCode = code;
    if (job.status === 'running') job.status = code === 0 ? 'passed' : 'failed';
    // a stopped run can't free the framework's lock itself: remove it once its process is gone
    if (kind === 'test' && fs.existsSync(RUN_LOCK) && !activeTestRun()) fs.rmSync(RUN_LOCK, { force: true });
    job.endedAt = new Date().toISOString();
    delete job.child;
    for (const listener of job.listeners) listener({ type: 'end', job: summary(job) });
    job.listeners.clear();
    saveHistory();
  });
  return summary(job);
}

function childEnv(extra) {
  // no colours in the output; keep the user's environment (PATH, the framework's settings), plus the company
  // root certificate from Setup when the network needs one (Claude and the test browsers' API calls use it)
  const ca = process.env.NODE_EXTRA_CA_CERTS || envValue('.env', 'NODE_EXTRA_CA_CERTS');
  return { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...(ca ? { NODE_EXTRA_CA_CERTS: ca } : {}), ...extra };
}

/** Errors a QA can't read on their own, with what to do (shown once per job). */
const HINTS = [
  {
    match: /self[- ]signed certificate|unable to get local issuer certificate|certificate.*(proxy|corporate)/i,
    text: '→ Your network inspects HTTPS (company proxy or antivirus). Ask IT for the company root certificate (.pem file), set its path in QA Studio → Setup → "Company root certificate", then restart QA Studio. Setup → System check → "Claude connection" tests it.',
  },
];

function push(job, raw) {
  const line = redactText(raw, secrets);
  job.lines.push(line);
  for (const hint of HINTS) {
    if (hint.match.test(line) && !job.lines.includes(hint.text)) {
      job.lines.push(hint.text);
      for (const listener of job.listeners) listener({ type: 'line', line: hint.text });
    }
  }
  if (job.lines.length > MAX_LINES) job.lines.splice(0, job.lines.length - MAX_LINES);
  for (const listener of job.listeners) listener({ type: 'line', line });
}

/** Stops a running job and everything it started (browsers too). */
export function stopJob(id) {
  const job = jobs.get(id);
  if (!job?.child?.pid) return false;
  job.status = 'stopped';
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(job.child.pid), '/T', '/F']);
  else job.child.kill('SIGTERM');
  return true;
}

/** A job of this session, or a finished one from the history with its saved output. */
export function getJob(id) {
  const live = jobs.get(id);
  if (live) return live;
  const saved = readHistory().find((j) => j.id === id);
  if (!saved) return undefined;
  const log = path.join(LOG_DIR, `${id}.log`);
  return { ...saved, lines: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n') : ['(the output of this job was not kept)'] };
}

/** Subscribe to a job's output: gets every line so far, then live lines and the end. Returns unsubscribe. */
export function follow(id, listener) {
  const job = jobs.get(id);
  if (!job) return undefined;
  for (const line of job.lines) listener({ type: 'line', line });
  if (job.status !== 'running') {
    listener({ type: 'end', job: summary(job) });
    return () => {};
  }
  job.listeners.add(listener);
  return () => job.listeners.delete(listener);
}

/** Jobs of this Studio session, newest first, plus earlier ones from the history file. */
export function listJobs() {
  const live = [...jobs.values()].map(summary);
  const ids = new Set(live.map((j) => j.id));
  return [...live, ...readHistory().filter((j) => !ids.has(j.id))].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function summary(job) {
  const { lines, listeners, child, ...rest } = job;
  return { ...rest, lineCount: lines.length };
}

function readHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    const finished = [...jobs.values()].filter((j) => j.status !== 'running').map(summary);
    const ids = new Set(finished.map((j) => j.id));
    const all = [...finished, ...readHistory().filter((j) => !ids.has(j.id))].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 200);
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(all, null, 2));
    for (const job of jobs.values()) {
      const log = path.join(LOG_DIR, `${job.id}.log`);
      if (job.status !== 'running' && !fs.existsSync(log)) fs.writeFileSync(log, job.lines.join('\n'));
    }
    // the output of jobs that dropped out of the history goes too
    const kept = new Set(all.map((j) => `${j.id}.log`));
    for (const file of fs.readdirSync(LOG_DIR)) if (!kept.has(file)) fs.rmSync(path.join(LOG_DIR, file), { force: true });
  } catch {
    // history is a convenience; never fail a job over it
  }
}
