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

/**
 * Mark the current test as failing because of an open bug. The test stays green while the bug
 * reproduces and turns red ("passed unexpectedly") once it is fixed, so QA knows to remove this line.
 * The report links the bug and tags the test `known-bug`.
 *
 * @example knownBug('SCRUM-456', 'Duplicate email is accepted');
 */
export function knownBug(jira: string, summary?: string): void {
  runLog.knownBug = { key: jira, summary };
  test.fail(true, `Known bug ${jira}${summary ? `: ${summary}` : ''}`);
}
