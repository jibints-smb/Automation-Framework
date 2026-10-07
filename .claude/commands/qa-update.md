---
description: Update tests after a developer changed a module MD (bug-fix iteration, new fields, changed rules)
argument-hint: <path to apps/<app>/requirements/*.md>
---

The developer updated the module requirement: **$ARGUMENTS**. Bring QA artefacts up to date with ONLY what changed.

1. Run `npm run req:diff -- $ARGUMENTS` and read the change report (added / changed / removed fields,
   messages, acceptance criteria, business rules, APIs, overview values). If there is no baseline, stop and
   use `/qa-testcases` instead.
2. Find the linked test-cases file (`apps/<app>/test-cases/*.testcases.md` whose `Source` row is this file)
   and update it:
   - **Added** field / AC / rule / message → new test cases with the next free IDs (never renumber existing IDs).
   - **Changed** rule or exact text → update the affected cases' steps and expected results; keep their IDs.
   - **Removed** behaviour → set those cases' `Automate` to `no` with "(removed in <date> change)" in the title;
     don't delete rows, so history stays traceable.
   - Priority/severity change → update tags/severity.
   - Add a line under a `## Change history` section at the end: date, summary of changes, affected IDs.
3. Update the automation for those IDs only, following `/qa-automate` conventions: model fields and rules,
   messages, page methods, data, specs (new tests; adjust changed ones; remove tests for removed behaviour).
   Use the Playwright MCP browser to confirm new fields/messages and their test IDs on the QA build.
4. Run `npx tsc --noEmit`, then the module's specs. Also re-run the module's `@smoke` tests; a bug fix
   can break the happy path.
5. Record the new baseline: `npm run req:baseline -- $ARGUMENTS --stage automated --note "<one-line summary>"`.
   Never record `signed-off`: that's QA's decision after re-testing.
6. Report back: the change list → affected test case IDs (new / updated / retired), test results,
   suspected bugs, and the **re-test list** QA should verify before sign-off
   (`npm run req:baseline -- $ARGUMENTS --stage signed-off --by "<QA name>"`).
