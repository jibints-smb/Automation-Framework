---
description: Investigate and fix failing tests (automation issue vs. real bug)
argument-hint: [spec path or @tag — empty = run everything for the active app]
---

Investigate failing tests for: **$ARGUMENTS** (if empty, run `npx playwright test` for the active app).

1. Determine the app (path after `apps/`, or `APP` in the root `.env`). Run the tests (no `--reporter`
   override). Collect each failure: test ID, error, and attachments in `test-results/` (screenshot, trace,
   error-context.md, and the framework's "Bug report" with its likely cause, expected vs actual and executed
   steps). The likely cause is a hint, not a verdict. Login failures in the `setup` project mean a wrong
   account in `apps/<app>/.env` or a changed login flow in `app.config.ts`.
2. For each web failure, reproduce it with the Playwright MCP browser tools: open the page, follow the
   steps and compare the expected and actual UI.
3. Decide the cause:
   - **Automation issue** (locator changed, timing, bad test data): fix the model / page / data, keeping
     CLAUDE.md conventions. Prefer fixing the model's locator over touching the spec.
   - **Framework issue** (a generic action in `src/` doesn't handle this UI component): fix it in `src/` only
     if the fix is generic for every app, and run all apps' type check.
   - **Application bug** (behaviour differs from the test-cases MD / requirement): do not change the
     expected result. Add `knownBug('<JIRA-BUG-KEY>', '<short summary>', { failsAt: /<part of the error>/ })`
     (from `@core/utils/allure`) as the first line of the test and add it to the summary. No Jira key yet: if
     the difference is in the sprint Differences table waiting for the PO, use `pendingDecision('<Dn>', '<summary>')`;
     otherwise leave the test failing and list it for QA. Never invent a Jira key.
   - **Unclear requirement**: leave the test as is and ask.
4. Re-run until the automation issues are gone. Report a table: test ID | cause | action taken.
