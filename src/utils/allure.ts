import { test } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { env } from '@core/config/env';
import { runLog } from '@core/report/runLog';

export type Severity = 'blocker' | 'critical' | 'normal' | 'minor' | 'trivial';

export interface StoryInfo {
  /** Jira epic or product area, e.g. "Authentication". */
  epic: string;
  /** Module / feature under test, e.g. "Login". */
  feature: string;
  /** Jira story title. */
  story: string;
  /** Jira story key, e.g. "SCRUM-101". Linked in the report when JIRA_BASE_URL is set. */
  jira?: string;
  /** Default for the story; a test case's own Priority (test-cases file) wins. */
  severity?: Severity;
  owner?: string;
}

/** Jira browse URL for a key, or the key itself when JIRA_BASE_URL is not set. */
export function jiraUrl(key: string): string {
  return env.jira.baseUrl ? `${env.jira.baseUrl.replace(/\/$/, '')}/browse/${key}` : key;
}

/**
 * Attach Jira/story metadata to the current test so the Allure report
 * can group results by Epic → Feature → Story and link back to Jira.
 *
 * @example test.beforeEach(() => storyInfo({ epic: 'Auth', feature: 'Login', story: 'User can log in', jira: 'SCRUM-101' }));
 */
export async function storyInfo(info: StoryInfo): Promise<void> {
  runLog.story = info;
  await allure.epic(info.epic);
  await allure.feature(info.feature);
  await allure.story(info.story);
  if (info.owner) await allure.owner(info.owner);
  if (info.jira) await allure.issue(jiraUrl(info.jira), info.jira);
}

export interface KnownBugOptions {
  /**
   * Where the bug shows: matched against the error (and the failing step). When the test fails somewhere else,
   * the report lists it under "Known bug: different failure", so a new problem isn't hidden by the known one.
   * @example { failsAt: /Duplicate email/ }
   */
  failsAt?: RegExp;
}

/**
 * Mark the current test as failing because of an open bug. The test stays green while the bug
 * reproduces and turns red ("passed unexpectedly") once it is fixed, so QA knows to remove this line.
 * The report links the bug, tags the test `known-bug` and counts it apart from passed tests.
 *
 * @example knownBug('SCRUM-456', 'Duplicate email is accepted', { failsAt: /already registered/ });
 */
export function knownBug(jira: string, summary?: string, options: KnownBugOptions = {}): void {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(jira)) {
    throw new Error(`knownBug needs a real Jira key like "BK-123", got "${jira}". Waiting for a PO decision? Use pendingDecision('D3', '...').`);
  }
  runLog.knownBug = { key: jira, summary, failsAt: options.failsAt };
  test.fail(true, `Known bug ${jira}${summary ? `: ${summary}` : ''}`);
}

/**
 * Mark the current test as failing because the build differs from the story and the PO hasn't decided yet
 * (a "Dn" row in the sprint's Differences table). Works like knownBug: the test stays green while the
 * difference is there, is listed under "Waiting for PO decision" and counted apart from passed tests,
 * and turns red once the app matches the test case. After the decision: remove this line, and either
 * keep the test (bug raised: knownBug) or update the test case (/qa-update) if the build is accepted.
 *
 * @example pendingDecision('D3', 'Unticked "Keep me signed in" deletes the saved login');
 */
export function pendingDecision(id: string, reason: string): void {
  runLog.pending = { id, reason };
  test.fail(true, `Waiting for PO decision ${id}: ${reason}`);
}
