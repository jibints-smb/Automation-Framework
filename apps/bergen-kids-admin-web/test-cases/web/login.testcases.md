# Test cases — Login

<!--
  Output of /qa-testcases, input of /qa-automate. Reviewed by QA before automation.
  Every row becomes one Playwright test titled "<ID> | <Title>" and tagged @<ID>.
  Expected results follow the Jira story. Where the build differs (D1–D5 in sprints/sprint-01.md, waiting for a
  PO decision), the case is marked "(Dn)": it fails on the current build until the PO decides; then /qa-update.
  Checked on staging 2026-10-07 (v0.2.0): D1 and D2 confirmed; D4 answered (email and password stay filled).
-->

| Item        | Value                                   |
| ----------- | --------------------------------------- |
| Source      | requirements/web/BK-1-login.md          |
| Jira        | BK-1                                    |
| Epic        | Authentication                          |
| Feature     | Login                                   |
| Platform    | web                                     |
| Spec file   | tests/web/login/login.spec.ts           |

## Preconditions
- Staging: https://stagingadminbergenkids.newagesmb.com, login page `/auth/login`.
- Super Admin account in `apps/bergen-kids-admin-web/.env`: `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.
- Tests start **logged out** (`test.use({ role: null })`), except TC-LOGIN-21 and TC-LOGIN-22 (logged in).
- Site data (localStorage key `bk-admin-remembered-login`) cleared before each test.
- No `data-testid` in the app: locators by role / label / the developers' ids (`#lg-email`, `#lg-pass`).
- Toasts close after about 2.6 s: assert them right after the action.

## Test cases
| ID           | Title | Type | Priority | Tags | Steps | Expected result | Automate |
| ------------ | ----- | ---- | -------- | ---- | ----- | --------------- | -------- |
| TC-LOGIN-01 | Login page shows all fields and controls | ui | normal | @regression | 1. Open /auth/login | Tab title "Sign in"; heading "Sign in to the admin panel"; subheading "Use your Bergen Kids admin credentials to login."; Email address (placeholder "Enter your email"), Password (placeholder "Enter your password") with "Show password" button, "Keep me signed in" checkbox, "Forgot?" link, "Sign in to dashboard" button | yes |
| TC-LOGIN-02 | Valid login opens the dashboard | positive | critical | @smoke @regression | 1. Open /auth/login 2. Enter the Super Admin email and password 3. Click "Sign in to dashboard" | Toast "Welcome back" ("Signing you in…"); the Admin Dashboard opens at `/` | yes |
| TC-LOGIN-03 | Pressing Enter signs in | positive | normal | @regression | 1. Enter valid email and password 2. Press Enter in the Password field | Same as TC-LOGIN-02 | yes |
| TC-LOGIN-04 | Empty email is rejected | negative | critical | @regression | 1. Leave Email empty, enter a password 2. Click "Sign in to dashboard" | "Please enter your email address." under Email; no sign-in happens; stays on /auth/login (D1: build shows "Enter your email address") | yes |
| TC-LOGIN-05 | Invalid email format is rejected | negative | critical | @regression | 1. Enter each: `admin`, `admin@`, `admin.bergen.com`, `admin@bergen` 2. Enter a password 3. Click "Sign in to dashboard" | "Please enter a valid email address." under Email for each; no sign-in (D1: build shows "Enter a valid email address") | yes |
| TC-LOGIN-06 | Empty password is rejected | negative | critical | @regression | 1. Enter a valid email, leave Password empty 2. Click "Sign in to dashboard" | "Please enter your password." under Password; no sign-in (D1: build shows "Enter your password") | yes |
| TC-LOGIN-07 | Both fields empty show both messages | negative | normal | @regression | 1. Leave both empty 2. Click "Sign in to dashboard" | Both email and password messages show (texts as TC-LOGIN-04 and 06); no sign-in (D1) | yes |
| TC-LOGIN-08 | Wrong password is rejected | negative | critical | @regression | 1. Enter the Super Admin email and a wrong password 2. Click "Sign in to dashboard" | Error toast "Invalid email address or password. Please try again."; stays on /auth/login; the button is enabled again | yes |
| TC-LOGIN-09 | Unknown email is rejected | negative | normal | @regression | 1. Enter an unregistered email (`uniqueEmail()`) and any password 2. Click "Sign in to dashboard" | Error toast "Invalid email address or password. Please try again."; stays on /auth/login | yes |
| TC-LOGIN-10 | Fields stay filled after a failed login | negative | normal | @regression | 1. Fail a login as in TC-LOGIN-08 | Email still shows the entered email; Password still holds the entered password | yes |
| TC-LOGIN-11 | Spaces around the email are trimmed | positive | normal | @regression | 1. Enter the Super Admin email with leading and trailing spaces 2. Enter the password 3. Sign in | Login succeeds; dashboard opens | yes |
| TC-LOGIN-12 | Email is not case-sensitive | positive | normal | @regression | 1. Enter the Super Admin email in UPPER CASE 2. Enter the password 3. Sign in | Login succeeds; dashboard opens | yes |
| TC-LOGIN-13 | Password is masked by default | security | normal | @regression | 1. Type a password | The password is hidden (input type password); the eye button reads "Show password" | yes |
| TC-LOGIN-14 | Show/Hide toggles the password without clearing it | ui | normal | @regression | 1. Type a password 2. Click "Show password" 3. Click "Hide password" | Step 2: password visible, button reads "Hide password"; step 3: masked again; the value never changes | yes |
| TC-LOGIN-15 | "Keep me signed in" is checked by default | ui | normal | @regression | 1. Clear site data 2. Open /auth/login | The checkbox is checked (D2: build is unticked; confirmed on staging) | yes |
| TC-LOGIN-16 | Ticked: login is remembered after logout | positive | normal | @regression | 1. Tick "Keep me signed in" 2. Sign in 3. Log out 4. Open /auth/login | Email and Password are filled in with the used credentials; localStorage key `bk-admin-remembered-login` exists | yes |
| TC-LOGIN-17 | Remembered login is gone after clearing site data | positive | minor | @regression | 1. Do TC-LOGIN-16 2. Clear site data (localStorage) 3. Open /auth/login | Email and Password are empty | yes |
| TC-LOGIN-18 | Unticked: login is not saved and an earlier saved login is kept | negative | normal | @regression | 1. Sign in with the box ticked, log out 2. Untick the box 3. Sign in again, log out 4. Open /auth/login | Story: the earlier saved login is still filled in, nothing new saved (D3: build deletes the saved login) | yes |
| TC-LOGIN-19 | "Forgot?" opens forgot password | positive | normal | @regression | 1. Click "Forgot?" | /auth/forgot-password opens (heading "Forgot your password?") | yes |
| TC-LOGIN-20 | Protected page while signed out returns there after login | positive | normal | @regression | 1. Signed out, open a protected admin page (e.g. `/`) 2. Sign in | Step 1: redirected to `/auth/login?callbackUrl=<that page>`; step 2: lands on that page | yes |
| TC-LOGIN-21 | Signed-in admin can't open the login page | positive | normal | @regression | 1. Signed in, open /auth/login | Redirected to the dashboard `/` | yes |
| TC-LOGIN-22 | Logout ends the session | positive | critical | @regression | 1. Signed in, log out 2. Open `/` | Step 1: /auth/login opens; step 2: redirected to /auth/login (session ended) | yes |
| TC-LOGIN-23 | Button is disabled while signing in | ui | minor | @regression | 1. Enter valid credentials 2. Click "Sign in to dashboard" | While the request runs the button reads "Signing in…" and is disabled | later |
| TC-LOGIN-24 | Session length follows "Keep me signed in" | positive | normal | @regression | 1. Sign in ticked; check the session cookie's expiry 2. Sign in unticked; check again | About 30 days ticked, about 1 day unticked, from the moment of login | later |
| TC-LOGIN-25 | Remembered password is not stored in plain text | security | critical | @regression | 1. Sign in with the box ticked 2. Read localStorage `bk-admin-remembered-login` | Pending PO / tech lead decision (D5). Build stores the password in plain text | later |
| TC-LOGIN-26 | Auth error toasts | negative | minor | @regression | 1. Make the auth callback fail / break the session cookie | "Authentication failed. Please try again." / "Something went wrong. Please try again." | no |
| TC-LOGIN-27 | Theme toggle switches light / dark | ui | minor | @regression | 1. Click "Switch colour theme" twice | The page switches to dark, then back to light | yes |
| TC-LOGIN-28 | Login page is accessible | accessibility | normal | @regression @a11y | 1. Open /auth/login | Meets WCAG 2.1 AA (no serious or critical axe violations) | yes |
| TC-LOGIN-29 | Login page looks as approved | visual | normal | @regression @visual | 1. Open /auth/login (light theme) | Matches the approved screenshot (footer version masked) | yes |
| TC-LOGIN-30 | Login page loads fast | performance | normal | @regression @perf | 1. Open /auth/login | First contentful paint under 2.5 s, load under 4 s, under 2 MB transferred | yes |
| TC-LOGIN-31 | Login API accepts valid credentials | api | normal | @regression @api | 1. POST `admin/auth/login` with valid email and password | 200; response has the tokens and the user; responds under 1 s | later |
| TC-LOGIN-32 | Login API rejects wrong credentials | api | normal | @regression @api | 1. POST `admin/auth/login` with a wrong password | Error status (401/400, TBD) with an error message | later |

<!-- Type: positive, negative, boundary, ui, security, api, accessibility, visual, performance. Extra tag for the last four: @api @a11y @visual @perf. Automate: yes / no (manual only) / later -->

Automate notes:
- TC-LOGIN-23 `later`: "Signing in…" shows only for the length of a fast request; needs a slow-network setting to check reliably.
- TC-LOGIN-24 `later`: the session cookie's name isn't known yet (ask the developers); then automatable by reading the cookie's expiry.
- TC-LOGIN-25 `later`: the expected result depends on the PO decision D5.
- TC-LOGIN-26 `no`: the auth calls run on the Next.js server, so the browser can't mock or trigger these errors.
- TC-LOGIN-31/32 `later`: the API base URL and error status aren't known (calls are server-side); the app's platforms don't include `api` yet.

## Change history
<!-- Added by /qa-update when the requirement changes. Never renumber IDs; retire removed cases with Automate: retired (and delete their test). -->
| Date | Requirement change | Test cases |
| ---- | ------------------ | ---------- |
