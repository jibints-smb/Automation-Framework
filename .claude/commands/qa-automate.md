---
description: Automate test cases from a test-cases MD (model → page/screen → data → spec → run → fix)
argument-hint: <path to apps/<app>/test-cases/*.md or a requirements md>
---

Automate the test cases in: **$ARGUMENTS**

The app is the folder after `apps/` in the path; run every command with `APP=<app>` set (or check the root
`.env`). If the file is a requirement rather than a test-cases file, run the `/qa-testcases` steps first.
Follow CLAUDE.md strictly. Look at `apps/saucedemo` as the reference implementation before writing anything.

## 1. Explore (web)
Read `apps/<app>/app.config.ts` for the base URL and `testIdAttribute`. Use the Playwright MCP browser
tools to open the page(s) under test; log in with the QA test account of the needed role from
`apps/<app>/.env` (never print credentials). Accessibility snapshots don't show test IDs, so list them with
`browser_evaluate`, e.g. `[...document.querySelectorAll('[data-testid]')].map(e => e.getAttribute('data-testid'))`
(use the app's attribute). Choose locators in this order: test ID → role + name → label → placeholder → text → css.
Confirm exact message texts by triggering them. Note custom dropdowns (what the options look like) and iframes.

For native mobile, Playwright MCP cannot drive the app: use the test IDs from the MD file. If any are
missing, list them and ask the user (Appium Inspector or the developers). React Native apps: a `testID`
is `{ id: '<testID>' }` (Android resource-id, iOS accessibilityIdentifier; needs `mobile.capabilities` from
`app.config.ts`), `accessibilityLabel` is `{ accessibilityId }`. Long or virtualized lists: `act.scrollTo(field)`
before using a row.

For API test cases (Type `api`, platform `api`): no browser. Call the endpoint once with `api` to see the real
response, then write its contract as a zod schema.

## 2. Build, reusing what exists in the app
1. **Model** `apps/<app>/models/<web|mobile>/<module>.model.ts` with `defineWebFields` / `defineMobileFields`:
   label, type, locator, rules (required, lengths, exact messages). `option:` for custom dropdowns whose
   options aren't `role="option"`; `frame:` for fields inside an iframe. Other messages in `<Module>Messages`.
   Export `type <Module>Data = FormData<typeof <Module>Fields>`.
2. **Page / screen** `apps/<app>/pages/<Module>Page.ts` extending `BasePage` (set `path`), or
   `apps/<app>/screens/<Module>Screen.ts` extending `BaseScreen`. Business methods only, built from
   `this.act` / `this.verify`. No raw locators.
   API: `apps/<app>/models/api/<module>.schema.ts` with zod schemas (`export type X = z.infer<typeof XSchema>`);
   no page object, specs call `api.get/post/...(url, { schema, expectStatus?, maxMs? })`.
3. **Fixture**: register it in `apps/<app>/fixtures.ts`.
4. **Data** `apps/<app>/data/<web|mobile|api>/<module>.data.ts`, typed with the model's data type; secrets via
   `getEnv(...)`; data-driven negative cases as an array of `{ id, title, data, error }`.
   Values that differ per environment (IDs, existing records): `forEnv(defaults, { staging: {...} })` from
   `@core/utils/data`. Names of records the test creates: `testDataName('<label>')` / `uniqueEmail()` from
   `@core/utils/random` (marked with the test-data prefix, so leftovers can be found).
5. **Spec** `apps/<app>/tests/<web|mobile|api>/<module>/<module>.spec.ts`
   - header comment linking the story and the test-cases file
   - `storyInfo({ epic, feature, story, jira, severity })` in `beforeEach`
   - one test per test case: title `<ID> | <Title>`, tags `['@smoke' | '@regression', '@<ID>']`; skip `Automate: no/later`
   - roles: `test.use({ role: '<role>' })`, or `{ role: null }` for logged out
   - data created through `api` must be removed with `cleanup.add(...)`; error/empty states via `act.mockApi(...)`
   - emails (OTP, verification link, reset): use the `mailbox` fixture: `newAddress('signup')` as the user's email,
     `waitForEmail(address, { subject })`, `otpFrom(email)` (`{ length, pattern }` for other formats) or `linkFrom`.
     Wrong-OTP cases: change one digit of the real code. Resend: the old code must fail, `newerThan` reads the new one.
     Run `npm run mail:check` first; if MAIL_* isn't set, ask the user to set up the test mailbox (never ask for the password in chat).
   - quality checks, one per test case of that Type, tagged `@a11y` / `@visual` / `@perf` / `@api` as well:
     `verify.accessible({ within?, ignoreRules? })`, `verify.looksLike('<name>', { mask: [changing fields] })`
     (always mask dates, IDs, random content), `verify.performance({ <metric>: <limit> })` right after `open()`.
     App-wide defaults go in `app.config.ts` `checks`, not in every call.
6. If a role or the login flow is missing from `app.config.ts`, add it there (with its `.env` variable names).

## 3. Verify
Run `npx tsc --noEmit`, then `npx playwright test <spec> --project=web-chrome` (or the mobile / `api` project).
A new `verify.looksLike` fails once per project with "no approved screenshot yet": open the new PNG in
`apps/<app>/screenshots/`, check it shows the expected screen, then re-run; never approve a screenshot you
haven't looked at. An accessibility violation is a product finding: report it (and `knownBug` it), don't add
the rule to `ignoreRules` unless QA says it is ticketed.
Fix failures caused by the automation (locators, waits, data). If a failure looks like a real application
bug, do not change the assertion: add `knownBug('<JIRA-BUG-KEY>', '<summary>')` (`@core/utils/allure`) as the
first line of the test and report it.
Do not pass `--reporter` on the command line. Finally run `npm run coverage:tc -- <app>` and, when every
automatable case passes, record the baseline: `npm run req:baseline -- <requirement.md> --stage automated`
(the requirement is the `Source` in the test-cases file).

## 4. Report back
Files created/changed, pass/fail per test case ID, suspected bugs, open questions, coverage line.
