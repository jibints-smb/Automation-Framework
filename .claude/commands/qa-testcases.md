---
description: Turn a Jira story / developer module MD into reviewed, structured test cases
argument-hint: <path to apps/<app>/requirements/<web|mobile|api>/*.md>
---

Create structured test cases from the requirement file: **$ARGUMENTS**

1. The app is the folder after `apps/` in the path. Read its `app.config.ts` (platforms, base URL, roles).
2. Read the requirement file. It may follow `templates/requirement.md` or be free-form developer notes.
   Extract: Jira key, epic, module, platform, URL or screen, fields (type, required, rules, exact error
   messages, test IDs), actions and outcomes, messages, business rules, UI states, roles, APIs, test data.
3. If the platform is web and a URL is known, you MAY use the Playwright MCP browser tools to open the page
   and confirm fields and messages exist (QA test accounts are in `apps/<app>/.env`; never print them).
4. Write `apps/<app>/test-cases/<web|mobile|api>/<module>.testcases.md` (same platform folder as the requirement) following `templates/testcases.md` exactly:
   - IDs `TC-<MODULE>-<NN>` (short uppercase module code, numbered from 01; keep existing IDs if the file exists).
   - Cover every acceptance criterion with at least one positive case; add negative cases for every required
     field and validation rule, boundary cases (min-1, min, max, max+1) where rules give limits, cases for
     business rules, each role's permissions, and UI states (empty, disabled, server error).
   - Email / OTP flows: valid code, wrong code, expired code, code used twice, resend (old code fails, new works),
     too many attempts, email not received ("Resend" available after the timer). Use `templates/otp-testcases.md`
     as the checklist: take the rows that apply, fill in the exact messages and limits from the requirement.
   - Non-functional, where the requirement or the page calls for it (Type and extra tag):
     `accessibility` (`@a11y`, one per main page/dialog: "meets WCAG 2.1 AA"), `visual` (`@visual`, key
     screens only, not every page), `performance` (`@perf`, with the budget as the expected result, e.g.
     "loads under 3 s, under 2 MB"), `api` (`@api`, platform `api`: status, response contract, error codes,
     response time for every endpoint the requirement lists).
   - Tag the main happy path `@smoke`; everything else `@regression`.
   - Mark `Automate` as `no` for things that cannot be automated reliably (e.g. real SMS) and say why.
5. The `Source` row must be the requirement path relative to the app folder (`requirements/<web|mobile|api>/<file>.md`, exactly as on disk); it
   links the two files for `npm run req:status`. Then record the baseline:
   `npm run req:baseline -- <requirement.md> --stage cases`.
   If test cases already exist for this requirement and it changed since, use `/qa-update` instead.
6. Do NOT write automation code in this step. Finish with a short summary: number of cases per type, and
   gaps or questions for the developer / PO (missing exact messages, test IDs, unclear rules), checked
   against the Definition of Ready in `docs/QA-Automation-Guide.pdf` section 5.
