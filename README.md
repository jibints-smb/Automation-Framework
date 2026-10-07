# QA Automation Framework

Company-wide, reusable test automation for **web** and **mobile** apps: Playwright (web), Appium (native
mobile), Claude Code with the Playwright MCP (test generation) and **Allure** reports.

- **One framework, many applications.** The shared engine lives in `src/`; each project gets its own folder
  in `apps/` with its settings, requirements, test cases and tests.
- **Markdown in, tests out.** A Jira story or developer module note becomes reviewed test cases, then
  automated tests with one test per test-case ID, all in one Allure report linked to Jira.

**New QA team member? Set up your machine first:** [docs/team-setup.html](docs/team-setup.html) (PDF: [docs/QA-Team-Setup.pdf](docs/QA-Team-Setup.pdf)): install, clone,
`.env` files, checking it works, daily commands, branches and pull requests, common problems (about 30 minutes).

**New to the project? Start here:** [docs/Getting-Started-Guide.pdf](docs/Getting-Started-Guide.pdf):
how Playwright + Claude AI automation works, setup from scratch, the framework's architecture and a full
module walkthrough.

**Process guide for developers and QA:** [docs/QA-Automation-Guide.pdf](docs/QA-Automation-Guide.pdf):
the testing steps and exactly what a module MD file must contain. Edit the HTML files in `docs/` and run
`npm run docs:pdf` to rebuild all four PDFs.

**Working in sprints (QA team):** [docs/sprint-qa-process.md](docs/sprint-qa-process.md) (web version:
[docs/sprint-qa-process.html](docs/sprint-qa-process.html), PDF: [docs/Sprint-QA-Process.pdf](docs/Sprint-QA-Process.pdf)): sprint steps, build day, what developers send,
where files live. Templates: `templates/sprint.md`, `templates/dev-handover.md`.

---

## 1. Setup (once per machine)

```bash
npm install
npm run setup                         # installs Chromium + WebKit
copy .env.example .env                # root settings: which APP, TEST_ENV, JIRA_BASE_URL
npm run test:web                      # sample app (saucedemo.com)
npm run report                        # Allure report
```

Requirements: Node.js 20+, VS Code with the Claude Code extension. No Java needed (Allure 3 runs on Node).

**Claude browser tool (MCP):** approve the **playwright** server when Claude asks. If `/mcp` doesn't list it:
```bash
claude mcp add playwright --scope user -- cmd /c npx -y @playwright/mcp@latest --isolated --output-dir=.playwright-mcp
```
(macOS/Linux: drop `cmd /c`.) Then reload VS Code and start a new Claude conversation.

**Native mobile (optional):** Android Studio (SDK + emulator) or a real device; `npm i -g appium`,
`appium driver install uiautomator2` (Android) / `appium driver install xcuitest` (iOS, macOS only); start
`appium`, and set `ANDROID_APP` (or package + activity) in the app's `.env`. Until then mobile tests skip.

## 2. Add your project

```bash
npm run new:app -- customer-portal --platforms web,mobile-web,android
```

Then:
1. `apps/customer-portal/app.config.ts`: base URL, test-id attribute, login roles and login steps.
2. `apps/customer-portal/.env`: QA accounts per role, app builds, API token.
3. Set `APP=customer-portal` in the root `.env` (or prefix commands: `APP=customer-portal npm test`).

```ts
// apps/<app>/app.config.ts
export default defineApp({
  name: 'Customer Portal',
  platforms: ['web', 'mobile-web', 'android'],
  web: { baseUrl: 'https://qa.portal.example.com', testIdAttribute: 'data-testid' },
  auth: {
    defaultRole: 'customer',
    roles: {
      customer: { usernameEnv: 'CUSTOMER_USERNAME', passwordEnv: 'CUSTOMER_PASSWORD' },
      admin: { usernameEnv: 'ADMIN_USERNAME', passwordEnv: 'ADMIN_PASSWORD' },
    },
    login: async (page, credentials) => { /* open login page, fill, submit, wait */ },
  },
});
```

## 3. Working with Claude (VS Code), per module

| Step | Command | Result |
| ---- | ------- | ------ |
| 1. Drop the story / dev notes | `apps/<app>/requirements/SCRUM-123-checkout.md` (template: `templates/requirement.md`) | |
| 2. Generate test cases | `/qa-testcases apps/<app>/requirements/SCRUM-123-checkout.md` | `apps/<app>/test-cases/checkout.testcases.md`, **review it** |
| 3. Automate | `/qa-automate apps/<app>/test-cases/checkout.testcases.md` | model, page, data, spec, run until green |
| 4. Triage failures | `/qa-fix apps/<app>/tests/web/checkout` | fixes automation issues, reports real bugs |
| 5. Check coverage | `npm run coverage:tc` | which test-case IDs are not automated yet |
| 6. Sign off | `npm run req:baseline -- <md> --stage signed-off --by "<name>"` | module marked tested at this version |

### When a developer changes a module after testing (bug-fix iterations)

QA's processed version of every module MD is recorded as a **baseline** (`apps/<app>/requirements/.baseline/`,
commit it). After the developer updates the MD:

```bash
npm run req:status                    # every module: stage, automation x/y, ⚠ CHANGED since baseline
npm run req:diff -- apps/<app>/requirements/web/SCRUM-101-login.md
#   ## Fields
#     ~ CHANGED  Password: Error message: "Password is required" → "Password must be at least 8 characters"
#     + ADDED    Remember me (Type: checkbox; Required: no; Locator hint: data-test=remember-me)
#   ## Acceptance criteria
#     + ADDED    AC5 After 3 wrong passwords the account is locked for 15 minutes ...
```

Then `/qa-update apps/<app>/requirements/web/SCRUM-101-login.md` adds/updates/retires only the affected test
cases and tests, runs them, and lists what QA must re-test. After re-testing, QA signs off:
`npm run req:baseline -- <md> --stage signed-off --by "<name>"`.

For web, Claude opens the real app through the MCP browser to find locators and confirm messages.
For native mobile, put the accessibility IDs in the MD (from Appium Inspector or the developers).

## 4. How the code is organised

```
src/                     SHARED FRAMEWORK (generic, used by every app)
  config/                env + app settings, defineApp()
  models/field.types.ts  Field, locators, FormData: how pages are described
  web/                   BasePage, WebActions, WebAssertions
  mobile/                BaseScreen, MobileActions, MobileAssertions, Appium driver
  api/                   ApiClient for setup / cleanup
  auth/                  logs in every role once per run
  fixtures/              core test: role, api, cleanup, driver, automatic report enrichment
  report/                Allure: test case in each test, failure cause, bug report for developers
  utils/                 report steps, Allure labels, knownBug(), cleanup, random data
apps/<app>/              ONE APPLICATION
  app.config.ts  fixtures.ts  .env
  requirements/  test-cases/  models/  pages/  screens/  data/  tests/web/  tests/mobile/
templates/               requirement.md, testcases.md
scripts/                 new-app, tc-coverage
```

### The four layers (example: [apps/saucedemo](apps/saucedemo))

**Model**: the fields, as data ([login.model.ts](apps/saucedemo/models/web/login.model.ts))
```ts
export const LoginFields = defineWebFields({
  username: { label: 'Username', type: 'text', locator: { testId: 'username' },
              rules: { required: true, messages: { required: 'Username is required' } } },
  password: { label: 'Password', type: 'password', locator: { testId: 'password' } },
  loginButton: { label: 'Login button', type: 'button', locator: { testId: 'login-button' } },
});
export type LoginData = FormData<typeof LoginFields>;   // { username?: string; password?: string }
```

**Page**: business actions built from generic `act` / `verify` ([LoginPage.ts](apps/saucedemo/pages/LoginPage.ts))
```ts
async login(data: LoginData) {
  await this.act.fillForm(this.fields, data);     // fills each field by its type
  await this.act.click(this.fields.loginButton);
}
```

**Data**: typed by the model ([login.data.ts](apps/saucedemo/data/web/login.data.ts)) · **Spec**: reads like the
test case ([login.spec.ts](apps/saucedemo/tests/web/login/login.spec.ts))

### Built-in capabilities

| Need | How |
| ---- | --- |
| Any form | `act.fillForm(model, data)` picks the action from each field's `type` |
| Custom dropdowns (MUI, Ant, React-Select…) | automatic; set `option: (v) => locator` if options aren't `role="option"` |
| Date fields | native `<input type=date>` (YYYY-MM-DD) and typed date pickers |
| Fields inside an iframe | `frame: '#payment-frame'` on the field |
| Radio groups, checkboxes, uploads, downloads, browser dialogs | `act.chooseRadio / check / upload / download / handleNextDialog` |
| Different users | `test.use({ role: 'admin' })`, `test.use({ role: null })` for logged out |
| Test data via API + cleanup | `api.post(...)`, `cleanup.add('Delete x', () => api.delete(...))` |
| Error / empty states | `act.mockApi(/\/api\/orders/, { status: 500, json: {...} })` |
| Mobile | same pattern: `defineMobileFields`, `BaseScreen`, `act.tap / type / fillForm / swipe`; per-platform locators |

## 5. Running tests

| Command | What |
| ------- | ---- |
| `npm test` | everything for the active app (projects come from its `platforms`) |
| `npm run test:web` / `test:mobile-web` | desktop Chrome / Pixel 7 + iPhone 15 emulation |
| `npm run test:android` / `test:ios` | native app via Appium |
| `npm run test:smoke` / `test:regression` | by tag |
| `npx playwright test --grep @TC-LOGIN-02` | one test case |
| `npm run test:ui` / `test:headed` / `test:debug` | interactive / visible / step-through |
| `APP=customer-portal npm test` | another app (PowerShell: `$env:APP='customer-portal'; npm test`) |
| `TEST_ENV=staging npm test` | uses `apps/<app>/.env.staging` |
| `npm run auth` | refresh the saved logins |
| `npm run coverage:tc -- <app> --strict` | test-case coverage; `--strict` fails when automatable cases are missing (CI) |

## 6. Reports

- `npm run report`: Allure report grouped by **Epic → Feature → Story**, with Jira links (`JIRA_BASE_URL`),
  readable steps (`Fill "Username" with "..."`, passwords masked), screenshots, video and trace on failure.
  Works the same for every app, with no code in the specs:
  - **Every test** shows its test case (preconditions, steps, expected result) from the `*.testcases.md`
    file, and its severity from the test case's Priority.
  - **Every failed test** starts with a summary (likely cause, failed step, expected vs actual) and has a
    **Bug report** attachment: steps to reproduce with the real data, environment, browser or device,
    page URL, browser console errors, failed API calls and a text copy for Jira.
  - **Categories** tab sorts failures into *Product bugs* (for developers), *Automation issues* (for QA)
    and *Environment problems*.
  - Open bugs: `knownBug('SCRUM-456', 'summary')` as the first line of a test. It stays green while the bug
    exists, links the bug, and turns red once the bug is fixed so QA removes the line.
  - The start page links the report and a **Dashboard** (charts and trends).
- `npm run report:html`: Playwright HTML report (trace viewer).
- **Run history:** every run's report is also saved for good in `reports/<app>/<date>_<time>_<env>_<STATUS>/report.html`
  (one file, opens offline with a double-click). `npm run reports` opens a list of all saved runs, newest first,
  with a filter box. Root `.env`: `REPORT_ARCHIVE=off` stops saving, `REPORT_KEEP_DAYS=30` deletes runs older than
  30 days (default `0` = keep forever).

## 7. Rules for contributors

- App-specific code goes in `apps/<app>/` only. Change `src/` only for generic improvements every app
  benefits from, and run all apps' tests when you do.
- Locators live only in models; specs use pages/screens; no sleeps. See [CLAUDE.md](CLAUDE.md).
- `.env` files hold QA test accounts only and are never committed.
