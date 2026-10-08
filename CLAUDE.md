# QA Automation Framework (Playwright + Appium + Claude MCP)

Company-wide test automation for web apps, mobile apps and APIs. One shared framework (`src/`), one folder per
application (`apps/<app>/`). Requirements (Jira stories, developer module notes) arrive as Markdown; we turn
them into test cases and then into automated tests. Reports are Allure.

## Active app
`APP` in the root `.env` (or `APP=<name>` on the command line) selects the app. Its settings are in
`apps/<app>/app.config.ts` (platforms, base URL, test-id attribute, login roles) and `apps/<app>/.env`.
Always check which app you are working on before creating files.
`QA_NAME` (and optional `QA_EMAIL`) in the root `.env` is the QA running the tests: "Tested by" in the report,
each test's Owner, the saved-runs list and `req:baseline` (falls back to the git user name).

## Workflow (per module)
1. `apps/<app>/requirements/<JIRA>-<module>.md`: story or dev notes (template: `templates/requirement.md`)
2. `/qa-testcases <requirement.md>` → `apps/<app>/test-cases/<module>.testcases.md` (QA reviews it)
3. `/qa-automate <testcases.md>` → model + page/screen + data + spec, run until green
4. `/qa-fix [spec|@tag]` → triage failures: automation issue vs. real bug
5. `npm run coverage:tc` → which test-case IDs are not automated yet
6. Developer changes a module MD later (bug-fix iteration) → `npm run req:status` flags it CHANGED,
   `npm run req:diff -- <md>` shows what changed, `/qa-update <md>` updates only the affected tests.

## Sprints (only QA uses the framework)
- `npm run sprint:new -- <NN>` creates `sprints/sprint-<NN>.md` and `sprint-<NN>/manual-results.md`. Set `SPRINT=<NN>` and
  `BUILD_VERSION=<build>` in the root `.env` so every run and report records them.
- Sprint start: QA writes `requirements/<web|mobile>/<JIRA>-<module>.md` from the Jira story (template format,
  Test IDs `TBD`) → `/qa-testcases`. That `cases` baseline is QA's expectation.
- Build day: developers send one MD per story in their own format + build details + credentials
  (checklist: `templates/dev-handover.md`). Save their MDs unchanged in
  `sprints/sprint-<NN>/from-dev/<YYYY-MM-DD>/`; credentials only in `apps/<app>/.env`. Merge each dev MD into its
  requirement file (keep the template structure, add a Change log row), then `req:status` → `req:diff` → `/qa-update`.
- Never organise `requirements/` or `test-cases/` by sprint (baselines are keyed by path); sprint bookkeeping
  goes in `sprints/sprint-<NN>.md` (template: `templates/sprint.md`; `sprint:report` reads its tables, keep the columns).
- Cases that aren't automated are tested by hand and recorded in `sprint-<NN>/manual-results.md` (pass/fail/blocked).
- Sprint end: `npm run sprint:report -- <NN>` (sign-off report for the PO: per story passed / failed / known bug /
  PO pending / not tested, open differences and questions) → QA signs off each story; sign-off is refused while a
  test fails, waits for the PO, or the requirement changed, and only QA runs it (never an AI assistant).

## Requirement baselines
`apps/<app>/requirements/.baseline/` stores the version of each MD that QA last processed (stage:
`cases` → `automated` → `signed-off`). Commands record `cases`/`automated` themselves; only QA records
`signed-off` (`npm run req:baseline -- <md> --stage signed-off --by "<name>"`). Never edit baseline files by
hand, never renumber test-case IDs (retire removed ones with `Automate: retired` and delete their test; `no` means manual only).

## Layout
```
src/                 SHARED FRAMEWORK: generic only, never app-specific code
  config/            env.ts (only place reading process.env), app.ts (defineApp, settings), paths.ts
  models/            field.types.ts: Field, WebLocator, MobileLocator, FormData, defineWebFields
  web/               BasePage, WebActions (act), WebAssertions (verify), locator resolver,
                     accessibility.ts (axe), performance.ts (page-load budgets)
  mobile/            BaseScreen, MobileActions, MobileAssertions, Appium driver + capabilities
  api/               ApiClient: REST for API tests and setup/cleanup, zod contracts, response time
  auth/              auth.setup.ts: logs in every role from app.config.ts
  mail/              Mailbox (`mailbox` fixture): test inbox over IMAP for OTP / verification emails
  fixtures/          core `test`: role, platform, api, cleanup, driver, mailbox, `report` (auto)
  report/            Allure enrichment: test case per test, failure cause + bug report attachment;
                     brand.mjs: company colours/logo/header (logo: branding/), archive.ts: saved runs,
                     redact.cjs: secrets masked in every report
  utils/             step(), storyInfo() / knownBug() (Allure), cleanup, random data, forEnv() (data per env)
apps/<app>/          ONE APPLICATION
  app.config.ts      platforms, web base URL, test-id attribute, auth roles + login steps, `checks` defaults
  fixtures.ts        extends core test with this app's pages/screens; specs import test from here
  models/web|mobile  field models          pages/  screens/   page & screen objects
  models/api         zod response schemas  screenshots/       approved screenshots (verify.looksLike)
  data/              typed test data       tests/web|mobile|api   specs
  requirements/      module MD files       test-cases/        reviewed test cases
  sprints/           sprint-NN.md trackers + from-dev/<date>/ developer MDs as received
templates/           requirement.md, testcases.md, sprint.md, manual-results.md, dev-handover.md, otp-testcases.md
scripts/             new-app, tc-coverage, trace-check, sprint (new/report), run-scope (test:story/sprint),
                     req-track, claude-cmd, brand-report, redact-results
.github/             CI workflow (checks on every PR, tests on demand), CODEOWNERS, PR template
.githooks/           pre-commit: type check + lint (enabled by npm install)
```
Imports: `@core/...` for the framework, `@apps/<app>/...` for app code.

## Rules
- Specs import `test`/`expect` from `@apps/<app>/fixtures`, never from `@playwright/test`.
- **Locators live only in models.** Pages/screens use `this.act.*` and `this.verify.*` with model fields.
  Dynamic locators are functions in the model returning a `WebField`/`MobileField`.
- Locator preference (web): `testId` → `role`+`name` → `label` → `placeholder` → `text` → `css`; avoid `xpath`.
  Mobile: `accessibilityId` → `id` → `text` → platform-specific selectors.
- UI components: dropdowns (native or custom), dates, radios and iframe fields are handled by `act.setValue`/`fillForm`
  from the field `type`. Custom dropdowns whose options aren't `role="option"` set `option: (v) => locator`;
  fields inside an iframe set `frame: '<iframe css>'`. Read-only date pickers are set directly.
- Elements in a row / card / dialog: model fields with `within: <parent field>`, `hasText` and `nth` (no CSS/XPath),
  e.g. the Delete button of one row: `{ ...F.deleteButton, within: { ...F.row, hasText: name } }`.
- Other actions: `act.clickAndWaitForResponse(field, /api\/save/, { status: 201 })` (wait for the server's answer),
  `act.openInNewTab(field)` (returns the new page), `act.dragTo(a, b)`, `act.waitUntilGone(loader)` (spinners,
  splash screens on slow environments), `act.download(field)` (saved and attached). `verify.soft.*`: same checks,
  a failure doesn't stop the test. Two-factor login: `totp(requireEnv('<ROLE>_TOTP_SECRET'))` from `@core/utils/totp`.
- Browsers per app: `web.browsers: ['chrome', 'firefox', 'safari', 'edge']` (projects `web-<browser>`), plus
  `web.locale`, `web.timezoneId`, `web.ignoreHTTPSErrors` in `app.config.ts`.
- Data types come from models: `type XData = FormData<typeof XFields>`; don't hand-write data interfaces.
- Specs read like test cases: one test per test-case ID, title `<ID> | <Title>`,
  tags `@smoke`/`@regression` + `@<ID>`, `storyInfo({...})` in `beforeEach`.
- The report finds each test's test case by the ID in its title, so keep titles `<ID> | <Title>` and test-case
  Priority/Expected result accurate. Every action/check goes through `step()` (act/verify do), so the bug
  report can list it. A confirmed app bug: `knownBug('<JIRA-KEY>', '<summary>', { failsAt: /<error text>/ })` as
  the first line of the test, never a weakened assertion. A build difference waiting for the PO (a `Dn` row in
  the sprint Differences table, no Jira key yet): `pendingDecision('D3', '<summary>')`. Both are counted apart
  from passed tests and flagged in the report once the app matches the test case. Never invent a Jira key.
- Secrets never reach reports: fields holding an OTP/PIN/card number set `sensitive: true` in the model
  (passwords are masked automatically); step titles, errors, logs, emails and results are redacted
  (`src/report/redact.cjs`). Saved runs keep videos only (`REPORT_EVIDENCE`); traces record typed passwords.
- No `waitForTimeout`/sleeps; use web-first assertions (`verify.*`) and auto-waiting actions.
- Tests start logged in as the app's default role. `test.use({ role: 'admin' })` for another role,
  `test.use({ role: null })` for logged out. Logins are saved per app, environment and role
  (`.auth/<app>/<env>/<role>.json`) and shared by all tests: a test that logs out on the server, changes the
  password or ends other sessions uses `test.use({ freshLogin: true })` (its own login, never shared).
- `TEST_ENV=<env>` needs `apps/<app>/.env.<env>` (a typo stops the run); app `.env` settings win over the root
  `.env`. One test run at a time per machine (a second run stops with a message; it would mix the reports).
- Create test data through `api` and register removal with `cleanup.add(...)`; test error/empty states with `act.mockApi(...)`.
  Name created records with `testDataName('<label>')` / `uniqueEmail()` (TEST_DATA_PREFIX marks them as test data).
  Data that differs per environment: `forEnv(defaults, { staging: {...} })` from `@core/utils/data`.
- Quality checks are test cases too (Type `accessibility`/`visual`/`performance`/`api`, extra tag
  `@a11y`/`@visual`/`@perf`/`@api`): `verify.accessible()`, `verify.looksLike('<name>', { mask })`,
  `verify.performance()`. App defaults (WCAG level, ignored rules, budgets) in `app.config.ts` `checks`.
  Approve a screenshot only after looking at it; commit `screenshots/` (one set per project and OS).
- API tests: `tests/api` (project `api`, platform `'api'`, no browser), contract as a zod schema in
  `models/api`: `api.get(url, { schema, expectStatus, maxMs })` returns the body typed. Also `form`, `multipart`
  (file uploads), `timeout`, and `retries` (502/503/504 or no connection: for setup/cleanup calls, not API checks).
- Email flows (signup OTP, verification link, password reset): `mailbox.newAddress('<label>')` gives a unique
  address in the test inbox (MAIL_* in the app .env, plus addressing), `mailbox.waitForEmail(address, { subject })`,
  then `mailbox.otpFrom(email)` / `mailbox.linkFrom(email, '/verify')`. Resend: `waitForEmail(..., { newerThan: first })`.
  Never hard-code an OTP unless QA has a fixed QA-only code (then `requireEnv('OTP_CODE')`).
  Standard OTP test cases: `templates/otp-testcases.md`; examples: `apps/saucedemo/tests/api/demo/email-demo.spec.ts`;
  guide: `docs/otp-email-testing.html`. Test inbox is a dedicated Gmail (IMAP), never Yopmail or other public inboxes.
- Flaky tests (passed only on a retry) are tagged `flaky` and listed in `reports/flaky.html`: fix the cause,
  never add retries or sleeps.
- App-specific settings: `getEnv('NAME')` / `requireEnv('NAME')` from `@core/config/env`.
- Anything app-specific goes in `apps/<app>/`; change `src/` only for generic features every app benefits from.
- Never print or commit secrets from `.env` files (they hold QA test accounts only).

## Commands
- `npx tsc --noEmit`: type check (run after every change) · `npm run lint`: framework rules (no test.only, no waitForTimeout, fixtures imports)
- `npx playwright test <file> --project=web-chrome`: run one spec
- `npm run test:web` · `test:mobile-web` · `test:android` · `test:ios` · `test:api` · `test:smoke` · `test:regression`
- `npm run test:a11y` · `test:visual` · `test:perf` (by tag) · `npm run visual:update -- <spec>`: approve changed screenshots
- `npm run flaky:check -- <spec> -g <ID>`: run 10x without retries · `RETRIES=<n>` overrides retries (CI 2, local 0)
- `npm run auth`: refresh saved logins · `npm run mail:check`: test the MAIL_* mailbox login
- `npm run demo:email`: email-testing practice on the test mailbox (`@demo` tests only run when the grep asks for `@demo`) · `npm run coverage:tc`: test-case coverage
- `npm run req:status` · `npm run req:diff -- <md>` · `npm run req:baseline -- <md> --stage <cases|automated|signed-off>`
- `npm run trace:check [-- <app>] [--strict]`: test cases vs. real tests (IDs, titles, tags, retired) + traceability
  matrix `reports/<app>/traceability.html/.csv` · `npm run sprint:new|sprint:report -- <NN>` ·
  `npm run test:story -- <JIRA>` / `test:sprint -- <NN>`: run one story's / one sprint's specs
- `npm run qa:testcases -- <md>` · `qa:automate -- <testcases.md>` · `qa:fix -- [spec|@tag]` · `qa:update -- <md>`: the
  /qa-* commands from the terminal via the Claude CLI (`scripts/claude-cmd.mjs`; `--chat` interactive, `--dry-run`)
- `npm run new:app -- <name> --platforms web,android`: new application
- `npm run report`: build and open the Allure report · `npm run reports`: every saved run (`reports/<app>/`, kept
  by `src/report/archive.ts`; `REPORT_ARCHIVE=off` while re-running one test many times)
- Don't pass `--reporter` on the CLI: it replaces the configured Allure reporter.
