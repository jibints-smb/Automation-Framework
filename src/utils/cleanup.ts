import { test } from '@playwright/test';
import * as allure from 'allure-js-commons';

type Task = { name: string; run: () => Promise<unknown> };

/**
 * Collects cleanup work during a test and runs it afterwards, even when the test fails.
 * Tasks run in reverse order (last created, first removed). A failing task is reported as a
 * warning on the test instead of failing it, so leftovers are visible but don't hide the real result.
 *
 * @example cleanup.add('Delete customer', () => api.delete(`/api/v1/customers/${id}`));
 */
export class Cleanup {
  private readonly tasks: Task[] = [];

  add(name: string, run: () => Promise<unknown>): void {
    this.tasks.push({ name, run });
  }

  async runAll(): Promise<void> {
    for (const task of this.tasks.reverse()) {
      try {
        await test.step(`Cleanup: ${task.name}`, task.run);
      } catch (error) {
        test.info().annotations.push({ type: 'warning', description: `Cleanup "${task.name}" failed: ${error}` });
        // also in Allure, so leftover data is visible there: filter by the tag
        await allure.tag('cleanup-failed');
        await test.info().attach(`Cleanup failed: ${task.name}`, { body: String(error), contentType: 'text/plain' });
      }
    }
  }
}
