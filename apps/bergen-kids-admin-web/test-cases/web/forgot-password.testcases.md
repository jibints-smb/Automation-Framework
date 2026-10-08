# Test cases — Forgot password

<!--
  Output of /qa-testcases, input of /qa-automate. Reviewed by QA before automation.
  Every row becomes one Playwright test titled "<ID> | <Title>" and tagged @<ID>.
  Expected results follow the Jira story. Where the build differs (D6–D16 in sprints/sprint-01.md, waiting for a
  PO decision), the case is marked "(Dn)": it fails on the current build until the PO decides; then /qa-update.
  Screen 1 is not in the Jira story (D6): its expected results come from the developers' notes and staging.
  Checked on staging 2026-10-07 (v0.2.0): screen 1 texts and messages confirmed; unknown email → D16.
-->

| Item        | Value                                   |
| ----------- | --------------------------------------- |
| Source      | requirements/web/BK-2-forgot-password.md |
| Jira        | BK-2                                    |
| Epic        | Authentication                          |
| Feature     | Forgot password                         |
| Platform    | web                                     |
| Spec file   | tests/web/forgot-password/forgot-password.spec.ts |

## Preconditions
- Staging: https://stagingadminbergenkids.newagesmb.com; screens `/auth/forgot-password` → `/auth/code-verification`
  → `/auth/set-password`. Tests run **logged out** (`test.use({ role: null })`) unless stated.
- The only admin: `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `apps/bergen-kids-admin-web/.env`.
- Code: email is not set up; the API accepts the fixed QA code `OTP_CODE` (1234). Code length `OTP_LENGTH` (4 now,
  6 once email is implemented). Tests read both with `requireEnv`, never hard-coded. A wrong code = any other
  `OTP_LENGTH` digits (e.g. 0000).
- Reaching screen 2 sends a code and starts a reset session for the real admin, but does **not** change the password.
  Only TC-FP-35 to 37 complete a reset (see their notes).
- The 30 s resend countdown runs in the browser: tests fast-forward it with Playwright's clock (`page.clock`), never
  with a sleep.
- No `data-testid` in the app: locators by role / label / ids (`#fp-email`, `#sp-password`, `#sp-confirm`,
  `#sp-password-rules`). Texts use curly apostrophes as on the page ("we’ll").

## Test cases
| ID        | Title | Type | Priority | Tags | Steps | Expected result | Automate |
| --------- | ----- | ---- | -------- | ---- | ----- | --------------- | -------- |
| TC-FP-01 | Forgot password screen shows its fields and texts | ui | normal | @regression | 1. On /auth/login click "Forgot?" | /auth/forgot-password, tab title "Forgot password"; label "Account recovery"; heading "Forgot your password?"; subheading "Enter your registered email and we’ll send you a verification code."; Email address focused; "Send verification code"; "← Back to sign in" | yes |
| TC-FP-02 | Empty email is rejected | negative | normal | @regression | 1. Leave Email empty 2. Click "Send verification code" | "Enter your email address" under Email; stays on the screen | yes |
| TC-FP-03 | Invalid email format is rejected | negative | normal | @regression | 1. Enter `admin`, `admin@`, `admin@bergen` in turn 2. Click "Send verification code" | "Enter a valid email address" under Email each time; stays on the screen | yes |
| TC-FP-04 | Unregistered email is not accepted | negative | normal | @regression | 1. Enter an unregistered email (`uniqueEmail()`) 2. Click "Send verification code" | Red banner; no code screen. Built text "No admin account found with that email address." (D16: reveals which emails are admins; PO / security to decide the wording) | yes |
| TC-FP-05 | Registered email sends a code and opens the code screen | positive | critical | @smoke @regression | 1. Enter `SUPERADMIN_EMAIL` 2. Click "Send verification code" | Button reads "Sending…" while busy; then `/auth/code-verification?sessionid=…&email=…` opens showing that email | yes |
| TC-FP-06 | Back from the forgot screen goes to login | positive | normal | @regression | 1. Click "← Back to sign in" | /auth/login opens | yes |
| TC-FP-07 | Page texts state the right code length | ui | minor | @regression | 1. Open /auth/forgot-password 2. Read the right-hand panel | Panel says the same length as the code (D12: says "six-digit" while the code is 4 digits; accepted until email goes live) | later |
| TC-FP-08 | Email with spaces or capitals on the forgot screen | negative | minor | @regression | 1. Enter `SUPERADMIN_EMAIL` with spaces around it, then in UPPER CASE 2. Send | Pending D13 (login trims and lower-cases; this screen doesn't) | later |
| TC-FP-09 | Code screen shows its fields and texts | ui | normal | @regression | 1. Reach the code screen (TC-FP-05) | Tab title "Verify your email"; heading "Verify your email"; "Enter the `OTP_LENGTH`-digit code sent to <email>"; `OTP_LENGTH` boxes, the first focused; "Resend code" with an "in Ns" countdown; back link | yes |
| TC-FP-10 | Only digits can be entered in the code | negative | normal | @regression | 1. On the code screen type `ab`, `#$`, a space 2. Paste `12a4` | Nothing but digits appears in the boxes; no check starts | yes |
| TC-FP-11 | Fewer digits than the code length are not checked | boundary | normal | @regression | 1. Type `OTP_LENGTH` − 1 digits | No "Verifying…", no error, stays on the code screen | yes |
| TC-FP-12 | Correct code opens the set-password screen | positive | critical | @smoke @regression | 1. On the code screen type `OTP_CODE` | "Verifying…" shows; `/auth/set-password?sessionid=…` opens (no submit button needed) | yes |
| TC-FP-13 | Wrong code is rejected | negative | critical | @regression | 1. Type a wrong `OTP_LENGTH`-digit code | "Invalid verification code. Please try again."; boxes cleared; first box focused; stays on the screen (D7: build shows "Incorrect code entered. Please try again.") | yes |
| TC-FP-14 | Resend waits 30 s after the screen opens | ui | normal | @regression | 1. Open the code screen 2. Fast-forward the clock to 29 s, then 30 s | "Resend code" disabled with the countdown "in 30s" … "in 1s"; enabled at 0 | yes |
| TC-FP-15 | Resend sends a new code | positive | normal | @regression | 1. Type a digit in the boxes 2. When "Resend code" is enabled, click it | "Sending…" while busy; toast "New code sent" ("Check <email> for a fresh `OTP_LENGTH`-digit code."); boxes cleared; countdown restarts at 30 s | yes |
| TC-FP-16 | Resend can be used repeatedly | positive | minor | @regression | 1. Resend 3 times, fast-forwarding 30 s between | Each resend succeeds with the toast; no limit in the UI | yes |
| TC-FP-17 | Old code stops working after a resend | negative | critical | @regression | 1. Receive code A 2. Resend, receive code B 3. Enter A, then B | A: "Invalid verification code. Please try again."; B: set-password screen | later |
| TC-FP-18 | Code email arrives with the right content | positive | critical | @regression | 1. Send a code to the admin email | Email arrives within 60 s; correct sender and subject; contains the `OTP_LENGTH`-digit code; no placeholders | later |
| TC-FP-19 | Back from the code screen goes to login | positive | normal | @regression | 1. On the code screen click the back link | Story: /auth/login (D11: build goes to /auth/forgot-password via "← Back to forgot password") | yes |
| TC-FP-20 | Expired reset session is handled | negative | normal | @regression | 1. Let the reset session expire 2. Enter a code or click Resend | Red banner "Your session has expired. Redirecting to sign in…"; /auth/login after 2 s | no |
| TC-FP-21 | Expired code is rejected | negative | critical | @regression | 1. Wait past the code expiry 2. Enter the code | Error (text TBD); resend offered | later |
| TC-FP-22 | Repeated wrong codes are limited | security | normal | @regression | 1. Enter a wrong code 10 times | Expected: lock or rate limit after N attempts (TBD). Build: no limit in the UI; backend may limit per IP | later |
| TC-FP-23 | Code screen can't be opened without its parameters | security | normal | @regression | 1. Open /auth/code-verification with no parameters | Redirected to /auth/login | yes |
| TC-FP-24 | Set-password screen shows its fields and rules | ui | normal | @regression | 1. Reach the set-password screen (TC-FP-12) | Tab title "Set password"; heading "Set a new password"; subheading "Choose a password you don't use anywhere else."; New password focused (placeholder "At least 8 characters"); Confirm password ("Re-enter the new password"); eye toggles; checklist of 5 rules, all grey; "Set password"; "← Back to sign in" | yes |
| TC-FP-25 | Password checklist ticks rules while typing | positive | normal | @regression | 1. Type `a`, then `aA`, `aA1`, `aA1!`, `aA1!aaaa` | Each rule turns green with a tick as soon as it is met: lowercase, uppercase, number, special character, then "At least 8 characters" | yes |
| TC-FP-26 | Password length boundary | boundary | critical | @regression | 1. Enter a 7-character password meeting the other rules, submit 2. Enter an 8-character one | 7: "Password does not meet the required criteria." and "At least 8 characters" red (D9); 8: rule green, accepted | yes |
| TC-FP-27 | Password missing one rule is rejected | negative | critical | @regression | 1. Submit each: no uppercase, no lowercase, no number, no special character (8+ characters) | "Password does not meet the required criteria." each time; the unmet rule shows red (D9: build shows "Your new password doesn't meet all the requirements yet.") | yes |
| TC-FP-28 | Empty new password is rejected | negative | critical | @regression | 1. Leave both fields empty 2. Click "Set password" | "Please enter a new password." under New password (D8: build shows "Enter a new password.") | yes |
| TC-FP-29 | Empty confirm password is rejected | negative | normal | @regression | 1. Enter a valid new password, leave Confirm empty 2. Click "Set password" | "Please confirm your new password." under Confirm password | yes |
| TC-FP-30 | Passwords that don't match are rejected | negative | critical | @regression | 1. Enter a valid new password and a different confirm password 2. Click "Set password" | "Passwords do not match. Please try again."; no reset (D10: build shows the live hint "Both passwords have to match", red after submit) | yes |
| TC-FP-31 | Matching passwords show a confirmation hint | positive | minor | @regression | 1. Enter the same valid password in both fields | Live hint "Both passwords match" (green) under Confirm password | yes |
| TC-FP-32 | Show/Hide works on both password fields | ui | minor | @regression | 1. Type in both fields 2. Click each eye button twice | Each field toggles between visible and masked independently; values unchanged | yes |
| TC-FP-33 | Back from the set-password screen goes to login | positive | normal | @regression | 1. On the set-password screen click "← Back to sign in" | /auth/login opens (not the code screen); the password is unchanged | yes |
| TC-FP-34 | Set-password screen can't be opened without a session | security | critical | @regression | 1. Open /auth/set-password with no `sessionid` | Redirected to /auth/login | yes |
| TC-FP-35 | Successful reset sets the new password | positive | critical | @regression | 1. Complete screens 1–2 2. Enter a new valid password twice 3. Click "Set password" | "Saving…"; toast "Password set" ("You can now sign in with your new password."); /auth/login opens | later |
| TC-FP-36 | New password works, old one doesn't | positive | critical | @regression | 1. After TC-FP-35, log in with the old password 2. Log in with the new password | Old: "Invalid email address or password. Please try again."; new: dashboard opens | later |
| TC-FP-37 | Reset signs out other sessions | security | normal | @regression | 1. Sign in in browser A 2. Reset the password in browser B 3. Reload in browser A | Browser A is sent to /auth/login | later |
| TC-FP-38 | Signed-in admin can't open the recovery screens | positive | normal | @regression | 1. Signed in, open /auth/forgot-password | Redirected to the dashboard `/` | yes |
| TC-FP-39 | Server error while setting the password | negative | minor | @regression | 1. Make the reset API fail | Red banner and error toast "Couldn't set password" with the API message, or "Something went wrong. Please try again." | no |
| TC-FP-40 | Forgot password screen is accessible | accessibility | normal | @regression @a11y | 1. Open /auth/forgot-password | Meets WCAG 2.1 AA (no serious or critical axe violations) | yes |
| TC-FP-41 | Code screen is accessible | accessibility | normal | @regression @a11y | 1. Reach the code screen | Meets WCAG 2.1 AA; the code boxes are labelled "Verification code" | yes |
| TC-FP-42 | Set-password screen is accessible | accessibility | normal | @regression @a11y | 1. Reach the set-password screen | Meets WCAG 2.1 AA; the checklist state is announced, not only shown by colour | yes |
| TC-FP-43 | Forgot API: send code | api | normal | @regression @api | 1. POST `admin/auth/password/forgot` with the admin email 2. With an unknown email | 1: 2xx with `{ session_id }`; 2: error with a message; each under 1 s | later |
| TC-FP-44 | Forgot API: verify code | api | normal | @regression @api | 1. POST `admin/auth/password/otp/verify` with the right code 2. With a wrong code 3. With an expired session | 1: 2xx with `{ session_id }`; 2: error; 3: 403 | later |
| TC-FP-45 | Forgot API: resend code | api | minor | @regression @api | 1. POST `admin/auth/password/otp/resend` with a valid session 2. With an expired one | 1: 2xx; 2: 403 | later |
| TC-FP-46 | Forgot API: reset password | api | normal | @regression @api | 1. POST `admin/auth/password/reset` with valid matching passwords 2. With mismatching / weak passwords | 1: 2xx; 2: error with a message | later |

<!-- Type: positive, negative, boundary, ui, security, api, accessibility, visual, performance. Extra tag for the last four: @api @a11y @visual @perf. Automate: yes / no (manual only) / later -->

Automate notes:
- TC-FP-07 `later`: the panel text is planned to be right once email (6 digits) goes live (D12).
- TC-FP-08 `later`: expected result waits for the PO decision D13.
- TC-FP-17, 18 `later`: need real codes by email (Gmail test inbox, `mailbox`); with the fixed code every code is the same.
- TC-FP-20 `no`: the reset-session expiry can't be triggered on demand (server-side; calls can't be mocked from the browser).
- TC-FP-21, 22 `later`: expiry time and attempt limit not defined yet.
- TC-FP-35 to 37 `later`: they change the only admin's password and sign out other sessions. Automate once the
  developers confirm the old password can be reused (the test sets it back) or a second admin account exists; then
  they run last, alone, followed by `npm run auth`.
- TC-FP-39 `no`: server-side API error can't be triggered or mocked from the browser.
- TC-FP-43 to 46 `later`: API base URL not known (calls run on the Next.js server); `api` not in the app's platforms yet.

## Change history
<!-- Added by /qa-update when the requirement changes. Never renumber IDs; retire removed cases with Automate: retired (and delete their test). -->
| Date | Requirement change | Test cases |
| ---- | ------------------ | ---------- |
