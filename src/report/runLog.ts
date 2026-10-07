/**
 * What happened during the current test, collected for the failure report.
 * A worker runs one test at a time, so module state is per test; the core `report` fixture resets it.
 */
export type StepStatus = 'passed' | 'failed' | 'running';

export interface StepEntry {
  title: string;
  depth: number;
  status: StepStatus;
}

export interface RunLog {
  steps: StepEntry[];
  depth: number;
  /** Set by storyInfo(); severity is applied at the end so a test case's own priority can win. */
  story?: { epic: string; feature: string; story: string; jira?: string; severity?: string };
  /** Set by knownBug(). */
  knownBug?: { key: string; summary?: string };
  /** Web: filled by the page fixture before the page closes. */
  web?: { url: string; browser: string; consoleErrors: string[]; failedRequests: string[] };
  /** Native app: filled by the driver fixture. */
  device?: string;
}

export let runLog: RunLog = newLog();

export function resetRunLog(): void {
  runLog = newLog();
}

function newLog(): RunLog {
  return { steps: [], depth: 0 };
}

/** Called by step(): records a step so the failure report can list exactly what was done. */
export async function recordStep<T>(title: string, body: () => Promise<T>): Promise<T> {
  const entry: StepEntry = { title, depth: runLog.depth, status: 'running' };
  const log = runLog;
  log.steps.push(entry);
  log.depth++;
  try {
    const result = await body();
    entry.status = 'passed';
    return result;
  } catch (error) {
    entry.status = 'failed';
    throw error;
  } finally {
    log.depth--;
  }
}
