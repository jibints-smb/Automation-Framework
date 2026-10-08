# BK-1 — Super Admin login

<!--
  QA requirement for BK-1. Drafted from the Jira story, then merged with the developers' notes of 2026-10-07
  (sprints/sprint-01/from-dev/2026-10-07/BK-1-login.md).
  Where the build differs from the Jira story, the story stays the expected result and the difference is marked
  "⚠ Build differs (Dn)". Each Dn is in sprints/sprint-01.md → "Differences found", waiting for a PO decision.
-->

## 1. Overview (required)
| Item              | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| Jira              | BK-1                                                   |
| Epic              | Authentication                                         |
| Module            | Login                                                  |
| Platform          | web                                                    |
| Environment / URL | https://stagingadminbergenkids.newagesmb.com/auth/login (tab title "Sign in") |
| Build / version   | v0.2.0 (shown in the page footer); received 2026-10-07 |
| Feature flag      | none                                                   |
| Priority          | critical                                               |
| Developer / QA    | TBD / QA Team                                          |

## 2. User story (required)
As a Super Admin, I want to log in to the Bergen Kids Admin Panel using my registered email address and password,
so that I can securely access the admin dashboard.

## 3. Acceptance criteria (required)
1. **AC1** Given the login page, then it shows Email Address, Password, a Show/Hide Password icon, a "Keep me signed in"
   checkbox, a "Forgot?" link and a "Sign in to dashboard" button. Heading "Sign in to the admin panel", subheading
   "Use your Bergen Kids admin credentials to login."
2. **AC2** Given valid credentials, when I click "Sign in to dashboard" (or press Enter), then I see the toast
   "Welcome back" ("Signing you in…") and land on the Admin Dashboard (`/`).
3. **AC3** Given an empty Email Address, when I click "Sign in to dashboard", then I see "Please enter your email address."
   under the field and no request is sent. ⚠ Build differs (D1): "Enter your email address"
4. **AC4** Given an email in an invalid format, when I click "Sign in to dashboard", then I see "Please enter a valid email address."
   ⚠ Build differs (D1): "Enter a valid email address"
5. **AC5** Given an empty Password, when I click "Sign in to dashboard", then I see "Please enter your password."
   ⚠ Build differs (D1): "Enter your password"
6. **AC6** Given a wrong email or password, when I click "Sign in to dashboard", then an error toast shows
   "Invalid email address or password. Please try again.", I stay on the login page, the email stays filled in, and
   the password stays filled in until I change it (checked on staging 2026-10-07: both stay filled; D4 closed).
7. **AC7** Given the email with leading/trailing spaces, when I log in, then the spaces are trimmed and login succeeds.
8. **AC8** Given the email in different letter case (e.g. ADMIN@…), when I log in with the right password, then login
   succeeds (the build lower-cases it).
9. **AC9** Given a typed password, then it is masked by default; clicking the eye icon ("Show password" / "Hide password")
   toggles visibility without clearing the value.
10. **AC10** Given the login page with no saved login, then "Keep me signed in" is checked by default.
    ⚠ Build differs (D2): unticked by default (ticked only if a login is saved)
11. **AC11** Given "Keep me signed in" is checked and login succeeds, when I log out and open the login page again,
    then Email Address and Password are filled in (localStorage key `bk-admin-remembered-login`), until site data is cleared.
12. **AC12** Given "Keep me signed in" is unchecked and login succeeds, then the credentials are not stored, and
    previously stored credentials are not overwritten. ⚠ Build differs (D3): unticked deletes the saved login
13. **AC13** Given the login page, when I click "Forgot?" (next to the Password label), then I am on `/auth/forgot-password` (BK-2).

Added from the build (not in the Jira story, accepted as built):
14. **AC14** Given I am signed out and open a protected page, then I am sent to `/auth/login?callbackUrl=<that page>`,
    and after login I land on that page instead of the dashboard.
15. **AC15** Given I am signed in and open any `/auth/*` page, then I am sent to the dashboard.
16. **AC16** Given I log out, then the session ends and I am on `/auth/login`; the saved login (AC11) stays.
17. **AC17** Session length: 30 days with "Keep me signed in" ticked, 1 day without, counted from login (not extended
    by activity); after it ends, the next page load goes to login. (Manual check; not automated.)

## 4. Entry point & preconditions (required)
- How to reach the screen: `/auth/login`, or any protected URL while signed out; Logout; "← Back to sign in" on the
  recovery screens.
- User role(s) that can access it: signed-out users only (one role: admin).
- Data that must exist first: the Super Admin account (`SUPERADMIN_EMAIL`).

## 5. Fields (required)
<!-- The app has no data-testid attributes; these are the developers' stable selectors. -->
| # | Field | Type | Test ID | Required | Default | Rules (length, format, range, options) | Depends on | Error message (exact text) |
| - | ----- | ---- | ------- | -------- | ------- | -------------------------------------- | ---------- | -------------------------- |
| 1 | Email Address | email | `#lg-email` (placeholder "Enter your email") | yes | empty, or the saved email | valid email format; trimmed and lower-cased before checking | | Empty: "Please enter your email address." · Invalid: "Please enter a valid email address." ⚠ D1 |
| 2 | Password | password | `#lg-pass` (placeholder "Enter your password") | yes | empty, or the saved password | masked by default; no length/format rules on login | | Empty: "Please enter your password." ⚠ D1 |
| 3 | Show/Hide Password | button (icon) | role button "Show password" / "Hide password" | | masked | toggles visibility; keeps the value | Password | |
| 4 | Keep me signed in | checkbox | label "Keep me signed in" | | checked (story) ⚠ D2: built unticked | ticked at successful login: saves email + password | | |
| 5 | Forgot? | link | role link "Forgot?" | | | opens `/auth/forgot-password` | | |

## 6. Actions & outcomes (required)
| Action (button/link) | Test ID | Enabled when | On success | On failure |
| -------------------- | ------- | ------------ | ---------- | ---------- |
| Sign in to dashboard (or Enter in a field) | role button "Sign in to dashboard" | always, except while signing in (disabled, reads "Signing in…") | Toast "Welcome back"; go to `callbackUrl` or `/` | Field errors (no request), or error toast; button enabled again |
| Forgot? | role link "Forgot?" | always | `/auth/forgot-password` | |
| Show/Hide Password | role button "Show password" | always | password shown / masked | |
| Theme toggle (top right) | TBD | always | light / dark theme | |

## 7. Messages (required)
| Key | Where shown | Test ID | Exact text |
| --- | ----------- | ------- | ---------- |
| email-required | under Email | `role="alert"` | Please enter your email address. ⚠ D1 built: "Enter your email address" |
| email-invalid | under Email | `role="alert"` | Please enter a valid email address. ⚠ D1 built: "Enter a valid email address" |
| password-required | under Password | `role="alert"` | Please enter your password. ⚠ D1 built: "Enter your password" |
| login-failed | error toast | toast | Invalid email address or password. Please try again. |
| auth-callback-failed | error toast | toast | Authentication failed. Please try again. |
| auth-other-error | error toast | toast | Something went wrong. Please try again. |
| login-success | success toast | toast | Welcome back — "Signing you in…" |

Toasts close by themselves after about 2.6 s: assert them right after the action (web-first assertions wait for them).

## 8. Business rules
- BR1: Email is trimmed and lower-cased before it is checked and sent.
- BR2: Ticked "Keep me signed in" + successful login → email and password saved **in plain text** in localStorage
  key `bk-admin-remembered-login` (the developers say the product asked for this; security risk raised as D5).
- BR3: Unticked + successful login → per story, nothing stored and existing data kept; ⚠ built: the key is deleted (D3).
- BR4: Logout does not delete the saved login.
- BR5: Session: 30 days ticked / 1 day unticked, from login; activity doesn't extend it. A failed token refresh sends
  the admin to login on the next navigation. A broken session cookie is cleared automatically.
- BR6: Signed-in admins can't open `/auth/*` pages (redirect to `/`).

## 9. UI states
- Loading: the button is disabled and reads "Signing in…"
- Empty: form empty, or filled from the saved login (BR2)
- Error (server / auth): toasts "Authentication failed. Please try again." / "Something went wrong. Please try again."
- Disabled / read-only conditions: the button only while a request is running

## 10. APIs (for test setup, cleanup and mocking)
The calls run on the Next.js server, so they don't appear in the browser's Network tab and **can't be mocked with
`act.mockApi`** from the browser. Error-toast states (auth callback failed, other errors) stay manual unless the
developers provide a way to trigger them.
| Method | Endpoint | Purpose | Success | Errors |
| ------ | -------- | ------- | ------- | ------ |
| POST | `admin/auth/login` | Sign in (`{ email, password }`) | tokens + user | invalid credentials |
| POST | `auth/token` | Background token refresh (`{ refresh_token }`) | new tokens | → login on next navigation |
| POST | `auth/logout` | Logout (bearer token) | | |

## 11. Test data & accounts (required)
| Purpose | Username / data | Password / secret (.env variable) | Notes |
| ------- | --------------- | --------------------------------- | ----- |
| Valid Super Admin | `SUPERADMIN_EMAIL` | `SUPERADMIN_PASSWORD` | The only admin account; used by all logged-in tests |
| Wrong password | `SUPERADMIN_EMAIL` | any wrong value (generated) | |
| Unknown email | generated, e.g. `uniqueEmail()` | any | |

- Cleanup: tests that check "Keep me signed in" clear localStorage (site data) before and after.
- OTP / captcha / email: none on login; no captcha mentioned by the developers.

## 12. Mobile only
Not applicable (web).

## 13. Out of scope / known issues
- Differences waiting for a PO decision (sprints/sprint-01.md): D1 validation texts, D2 checkbox default,
  D3 unticked deletes the saved login, D5 password stored in plain text. D4 closed (fields stay filled).
- Still open: lockout after N failed attempts (not mentioned by the developers; assumed none).
- Out of scope: password rules (BK-2); long session-length checks (AC17) are manual.

## 14. Change log
| Date | Change | By |
| ---- | ------ | -- |
| 2026-10-07 | Drafted from the Jira story, before the build; test IDs TBD | QA Team |
| 2026-10-07 | Checked on staging v0.2.0: D1, D2 confirmed; D4 closed (email and password stay filled after a failed login) | QA Team |
| 2026-10-07 | Merged developer notes (from-dev/2026-10-07): URLs, selectors, toasts, session rules, AC14–AC17 added; differences D1–D5 marked | QA Team |
