import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR, env } from './env';

/** Marks a test run in progress: two runs at once on one machine would overwrite each other's Allure results. */
export const RUN_LOCK = path.join(ROOT_DIR, '.qa-run.lock');

/** Runs once before the whole test run: one run at a time, and every run starts with fresh Allure results. */
export default function globalSetup() {
  const other = activeRun();
  if (other) {
    throw new Error(
      `Another test run is in progress (process ${other.pid}, ${other.app}, started ${other.started}). ` +
        'Two runs at once would mix their Allure results and reports. Wait for it to finish or stop it, then re-run.',
    );
  }
  fs.writeFileSync(RUN_LOCK, JSON.stringify({ pid: process.pid, app: env.app, started: new Date().toLocaleString() }));
  fs.rmSync(path.join(ROOT_DIR, 'allure-results'), { recursive: true, force: true });
}

/** The run holding the lock, if its process is still alive (a lock left by Ctrl+C is ignored). */
export function activeRun(): { pid: number; app: string; started: string } | undefined {
  try {
    const lock = JSON.parse(fs.readFileSync(RUN_LOCK, 'utf8'));
    if (lock.pid === process.pid) return undefined;
    process.kill(lock.pid, 0); // throws when the process no longer exists
    return lock;
  } catch {
    return undefined;
  }
}

/** Frees the lock: called by the report archive after the run's report is saved (the last thing a run does). */
export function releaseRunLock(): void {
  try {
    if (JSON.parse(fs.readFileSync(RUN_LOCK, 'utf8')).pid === process.pid) fs.rmSync(RUN_LOCK, { force: true });
  } catch {
    // no lock: nothing to free
  }
}
