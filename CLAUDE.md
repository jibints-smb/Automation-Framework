# QA Automation Framework (Playwright + Appium + Claude MCP)

Company-wide test automation for web apps, mobile apps and APIs. One shared framework (`src/`), one folder per
application (`apps/<app>/`). Requirements (Jira stories, developer module notes) arrive as Markdown; we turn
them into test cases and then into automated tests. Reports are Allure.

## Active app
`APP` in the root `.env` (or `APP=<name>` on the command line) selects the app. Its settings are in
`apps/<app>/app.config.ts` (platforms, base URL, test-id attribute, login roles) and `apps/<app>/.env`.
Always check which app you are working on before creating files.

## Workflow (per module)
1. `apps/<app>/requirements/<JIRA>-<module>.md`: story or dev notes (template: `templates/requirement.md`)
2. `/qa-testcases <requirement.md>` → `apps/<app>/test-cases/<module>.testcases.md` (QA reviews it)
3. `/qa-automate <testcases.md>` → model + page/screen + data + spec, run until green
4. `/qa-fix [spec|@tag]` → triage failures: automation issue vs. real bug
5. `npm run coverage:tc` → which test-case IDs are not automated yet
6. Developer changes a module MD later (bug-fix iteration) → `npm run req:status` flags it CHANGED,
   `npm run req:diff -- <md>` shows what changed, `/qa-update <md>` updates only the affected tests.

## Sprints (only QA uses the framework)
- Sprint start: QA writes `requirements/<web|mobile>/<JIRA>-<module>.md` from the Jira story (template format,
  Test IDs `TBD`) → `/qa-testcases`. That `cases` baseline is QA's expectation.
- Build day: developers send one MD per story in their own format + build details + credentials
  (checklist: `templates/dev-handover.md`). Save their MDs unchanged in
  `sprints/sprint-<NN>/from-dev/<YYYY-MM-DD>/`; credentials only in `apps/<app>/.env`. Merge each dev MD into its
  requirement file (keep the template structure, add a Change log row), then `req:status` → `req:diff` → `/qa-update`.
- Never organise `requirements/` or `test-cases/` by sprint (baselines are keyed by path); sprint bookkeeping
  goes in `sprints/sprint-<NN>.md` (template: `templates/sprint.md`).

## Requirement baselines
`apps/<app>/requirements/.baseline/` stores the version of each MD that QA last processed (stage:
`cases` → `automated` → `signed-off`). Commands record `cases`/`automated` themselves; only QA records
`signed-off` (`npm run req:baseline -- <md> --stage signed-off --by "<name>"`). Never edit baseline files by
hand, never renumber test-case IDs (retire removed ones with `Automate: no`).

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
  report/            Allure enrichment: test case per test, failure cause + bug report attachment
  utils/             step(), storyInfo() / knownBug() (Allure), cleanup, random data, forEnv() (data per env)
apps/<app>/          ONE APPLICATION
  app.config.ts      platforms, web base URL, test-id attribute, auth roles + login steps, `checks` defaults
  fixtures.ts        extends core test with this app's pages/screens; specs import test from here
  models/web|mobile  field models          pages/  screens/   page & screen objects
  models/api         zod response schemas  screenshots/       approved screenshots (verify.looksLike)
  data/              typed test data       tests/web|mobile|api   specs
  requirements/      module MD files       test-cases/        reviewed test cases
  sprints/           sprint-NN.md trackers + from-dev/<date>/ developer MDs as received
templates/           requirement.md, testcases.md, sprint.md, dev-handover.md
scripts/             new-app.mjs, tc-coverage.mjs
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
  fields inside an iframe set `frame: '<iframe css>'`.
- Data types come from models: `type XData = FormData<typeof XFields>`; don't hand-write data interfaces.
- Specs read like test cases: one test per test-case ID, title `<ID> | <Title>`,
  tags `@smoke`/`@regression` + `@<ID>`, `storyInfo({...})` in `beforeEach`.
- The report finds each test's test case by the ID in its title, so keep titles `<ID> | <Title>` and test-case
  Priority/Expected result accurate. Every action/check goes through `step()` (act/verify do), so the bug
  report can list it. A confirmed app bug: `knownBug('<JIRA-KEY>', '<summary>')` as the first line of the test,
  never a weakened assertion.
- No `waitForTimeout`/sleeps; use web-first assertions (`verify.*`) and auto-waiting actions.
- Tests start logged in as the app's default role. `test.use({ role: 'admin' })` for another role,
  `test.use({ role: null })` for logged out.
- Create test data through `api` and register removal with `cleanup.add(...)`; test error/empty states with `act.mockApi(...)`.
  Name created records with `testDataName('<label>')` / `uniqueEmail()` (TEST_DATA_PREFIX marks them as test data).
  Data that differs per environment: `forEnv(defaults, { staging: {...} })` from `@core/utils/data`.
- Quality checks are test cases too (Type `accessibility`/`visual`/`performance`/`api`, extra tag
  `@a11y`/`@visual`/`@perf`/`@api`): `verify.accessible()`, `verify.looksLike('<name>', { mask })`,
  `verify.performance()`. App defaults (WCAG level, ignored rules, budgets) in `app.config.ts` `checks`.
  Approve a screenshot only after looking at it; commit `screenshots/` (one set per project and OS).
- API tests: `tests/api` (project `api`, platform `'api'`, no browser), contract as a zod schema in
  `models/api`: `api.get(url, { schema, expectStatus, maxMs })` returns the body typed.
- Email flows (signup OTP, verification link, password reset): `mailbox.newAddress('<label>')` gives a unique
  address in the test inbox (MAIL_* in the app .env, plus addressing), `mailbox.waitForEmail(address, { subject })`,
  then `mailbox.otpFrom(email)` / `mailbox.linkFrom(email, '/verify')`. Resend: `waitForEmail(..., { newerThan: first })`.
  Never hard-code an OTP unless QA has a fixed QA-only code (then `requireEnv('OTP_CODE')`).
- Flaky tests (passed only on a retry) are tagged `flaky` and listed in `reports/flaky.html`: fix the cause,
  never add retries or sleeps.
- App-specific settings: `getEnv('NAME')` / `requireEnv('NAME')` from `@core/config/env`.
- Anything app-specific goes in `apps/<app>/`; change `src/` only for generic features every app benefits from.
- Never print or commit secrets from `.env` files (they hold QA test accounts only).

## Commands
- `npx tsc --noEmit`: type check (run after every change)
- `npx playwright test <file> --project=web-chrome`: run one spec
- `npm run test:web` · `test:mobile-web` · `test:android` · `test:ios` · `test:api` · `test:smoke` · `test:regression`
- `npm run test:a11y` · `test:visual` · `test:perf` (by tag) · `npm run visual:update -- <spec>`: approve changed screenshots
- `npm run flaky:check -- <spec> -g <ID>`: run 10x without retries · `RETRIES=<n>` overrides retries (CI 2, local 0)
- `npm run auth`: refresh saved logins · `npm run mail:check`: test the MAIL_* mailbox login
- `npm run demo:email`: email-testing practice on the test mailbox (`@demo` tests only run when the grep asks for `@demo`) · `npm run coverage:tc`: test-case coverage
- `npm run req:status` · `npm run req:diff -- <md>` · `npm run req:baseline -- <md> --stage <cases|automated|signed-off>`
- `npm run new:app -- <name> --platforms web,android`: new application
- `npm run report`: build and open the Allure report · `npm run reports`: every saved run (`reports/<app>/`, kept
  by `src/report/archive.ts`; `REPORT_ARCHIVE=off` while re-running one test many times)
- Don't pass `--reporter` on the CLI: it replaces the configured Allure reporter.
