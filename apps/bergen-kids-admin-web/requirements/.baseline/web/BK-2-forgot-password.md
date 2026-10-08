# BK-2 — Super Admin forgot password

<!--
  QA requirement for BK-2. Drafted from the Jira story, then merged with the developers' notes of 2026-10-07
  (sprints/sprint-01/from-dev/2026-10-07/BK-2-forgot-password.md).
  Where the build differs from the Jira story, the story stays the expected result and the difference is marked
  "⚠ Build differs (Dn)". Each Dn is in sprints/sprint-01.md → "Differences found", waiting for a PO decision.
  The build has 3 screens (email → code → new password); the story described 2 (code → new password).
  QA situation: email is not set up; the staging API accepts the fixed code 1234 (OTP_CODE in .env).
  Code length: 4 digits NOW (fixed QA code, no email); 6 digits once email is implemented (D12).
  Everywhere below, "the code length" means OTP_LENGTH in .env (4 now, 6 later).
-->

## 1. Overview (required)
| Item              | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| Jira              | BK-2                                                   |
| Epic              | Authentication                                         |
| Module            | Forgot password                                        |
| Platform          | web                                                    |
| Environment / URL | https://stagingadminbergenkids.newagesmb.com/auth/forgot-password → /auth/code-verification → /auth/set-password |
| Build / version   | Received 2026-10-07 (build date not given by the developers) |
| Feature flag      | none                                                   |
| Priority          | critical                                               |
| Developer / QA    | TBD / QA Team                                          |

## 2. User story (required)
As a Super Admin, I want to reset my password if I forget it, so that I can regain secure access to the
Bergen Kids Admin Panel.

## 3. Acceptance criteria (required)
**Screen 1 – Forgot password (`/auth/forgot-password`)** — added by the build (D6), not in the Jira story
1. **AC1** Given the login page, when I click "Forgot?", then I am on "Forgot your password?" (label "Account recovery",
   subheading "Enter your registered email and we'll send you a verification code.") with the email field focused.
2. **AC2** Given an empty or invalid email, when I click "Send verification code", then I see "Enter your email address" /
   "Enter a valid email address" under the field.
3. **AC3** Given the registered admin email, when I click "Send verification code" (reads "Sending…" while busy), then a
   code (4 digits now, 6 after email is implemented) is sent and I am on the code screen.
4. **AC4** Given an email the API rejects, then a red banner shows the API's message (or "Something went wrong. Please try again.").
   For an unregistered email staging shows "No admin account found with that email address." ⚠ D16: this tells anyone
   which emails are admin accounts (account enumeration); PO / security to decide the wording.
5. **AC5** Given screen 1, when I click "← Back to sign in", then I am on `/auth/login`.
6. **AC6** The page texts state the code length consistently. Interim (D12): the right-hand panel already says
   "six-digit" (the length after email is implemented), while the code screen says "4-digit" and has 4 boxes. Accepted
   until email goes live; then everything must say 6 digits. Not tested until then.

**Screen 2 – Verify code (`/auth/code-verification`)** — the story's "Step 1"
7. **AC7** Given the code screen, then it shows "Verify your email", "Enter the {OTP_LENGTH}-digit code sent to {email}"
   (now "4-digit"), {OTP_LENGTH} digit boxes (now 4; first one focused), "Resend code" and a back link.
8. **AC8** Given the code boxes, then only digits can be typed or pasted; letters, symbols and spaces are not accepted.
9. **AC9** Given a valid code, when I enter the last digit, then it is checked automatically ("Verifying…") and I am on
   the set-password screen.
10. **AC10** Given an invalid code, when I enter the last digit, then I see "Invalid verification code. Please try again.",
    the boxes are cleared and the first box is focused; I stay on the screen.
    ⚠ Build differs (D7): "Incorrect code entered. Please try again."
11. **AC11** Given the code screen, then "Resend code" is disabled with an "in Ns" countdown for 30 s after the screen
    opens and after each resend, then becomes enabled (the build also disables it on opening: accepted, D15).
12. **AC12** Given "Resend code" is enabled, when I click it, then a new code is sent, the toast "New code sent" ("Check
    {email} for a fresh {OTP_LENGTH}-digit code.") shows, the boxes are cleared and the countdown restarts at 30 s. No limit on resends.
13. **AC13** Given I resent the code, then only the newest code is valid. (Can't be automated while the code is fixed 1234.)
14. **AC14** Given the code screen, when I click Back, then I am on the Login page.
    ⚠ Build differs (D11): "← Back to forgot password" goes to `/auth/forgot-password`
15. **AC15** Given the reset session expired (API 403), then a red banner "Your session has expired. Redirecting to sign
    in…" shows and I am on `/auth/login` after 2 s. (Manual: can't be triggered on demand.)

**Screen 3 – Set a new password (`/auth/set-password`)** — the story's "Step 2"
16. **AC16** Given the set-password screen, then it shows "Set a new password", New password (focused) and Confirm
    password with eye toggles, the 5-rule checklist, "Set password" and "← Back to sign in".
17. **AC17** Given the checklist (at least 8 characters, an uppercase letter, a lowercase letter, a number, a special
    character), when I type, then each met rule turns green with a tick; unmet rules are grey, and red after a failed submit.
18. **AC18** Given an empty New password, when I click "Set password", then I see "Please enter a new password."
    ⚠ Build differs (D8): "Enter a new password."
19. **AC19** Given a New password missing a rule, when I click "Set password", then I see "Password does not meet the
    required criteria." ⚠ Build differs (D9): "Your new password doesn't meet all the requirements yet."
20. **AC20** Given an empty Confirm password, when I click "Set password", then I see "Please confirm your new password."
21. **AC21** Given Confirm password differs, when I click "Set password", then I see "Passwords do not match. Please try again."
    ⚠ Build differs (D10): only a live hint "Both passwords have to match" (grey, red after submit); "Both passwords
    match" (green) when equal
22. **AC22** Given valid, matching passwords, when I click "Set password" (reads "Saving…"), then the toast "Password set"
    ("You can now sign in with your new password.") shows and I am on `/auth/login`.
23. **AC23** Given an API error, then a red banner and the error toast "Couldn't set password" show the API message
    (or "Something went wrong. Please try again."). (Manual: can't be triggered on demand.)
24. **AC24** Given the set-password screen, when I click "← Back to sign in", then I am on the Login page (not the code screen).

**After the reset / access rules**
25. **AC25** Given the password was reset, when I log in with the email and the new password, then login succeeds;
    BK-1 rules still apply.
26. **AC26** Given the password was reset, when I log in with the old password, then I see "Invalid email address or
    password. Please try again."
27. **AC27** Given the password was reset, then other sessions using the old password are signed out (build, D14).
28. **AC28** Given I open the code or set-password screen without its URL parameters, then I am sent to `/auth/login`.
29. **AC29** Given I am signed in, when I open any of the three screens, then I am sent to the dashboard.

## 4. Entry point & preconditions (required)
- How to reach the screen: Login page → "Forgot?"; screen 2 only after screen 1; screen 3 only after a valid code.
- User role(s) that can access it: signed-out users only (one role: admin).
- Data that must exist first: the Super Admin account (`SUPERADMIN_EMAIL`); it is the only admin account.

## 5. Fields (required)
<!-- The app has no data-testid attributes; these are the developers' stable selectors. -->
| # | Field | Type | Test ID | Required | Default | Rules (length, format, range, options) | Depends on | Error message (exact text) |
| - | ----- | ---- | ------- | -------- | ------- | -------------------------------------- | ---------- | -------------------------- |
| 1 | Email address (screen 1) | email | `#fp-email` | yes | empty, focused | valid email format; **not** trimmed or lower-cased (unlike login, D13) | | Empty: "Enter your email address" · Invalid: "Enter a valid email address" |
| 2 | Verification code (screen 2) | digit boxes: 4 now, 6 after email | label "Verification code" (`fill(code)` fills all boxes) | yes | empty, first box focused | digits only, exactly `OTP_LENGTH` (4 now, 6 later); auto-check on the last digit | | "Invalid verification code. Please try again." ⚠ D7 |
| 3 | New password (screen 3) | password | `#sp-password` (placeholder "At least 8 characters") | yes | empty, focused | ≥ 8 characters, an uppercase, a lowercase, a number, a special character (not a letter or digit) | | Empty: "Please enter a new password." ⚠ D8 · Rules: "Password does not meet the required criteria." ⚠ D9 |
| 4 | Confirm password (screen 3) | password | `#sp-confirm` (placeholder "Re-enter the new password") | yes | empty | must equal New password | New password | Empty: "Please confirm your new password." · Mismatch: "Passwords do not match. Please try again." ⚠ D10 |
| 5 | Eye toggles (screen 3) | button (icon) | role button "Show password" / "Hide password" | | masked | toggle visibility, keep value | | |
| 6 | Password checklist | list | `#sp-password-rules` | | grey | rule turns green when met; red after a failed submit | New password | |

## 6. Actions & outcomes (required)
| Action (button/link) | Test ID | Enabled when | On success | On failure |
| -------------------- | ------- | ------------ | ---------- | ---------- |
| Forgot? (login page) | role link "Forgot?" | always | `/auth/forgot-password` | |
| Send verification code | role button "Send verification code" | always, except while sending ("Sending…") | code sent; screen 2 | field errors, or red banner with the API message |
| ← Back to sign in (screen 1) | role link/button "← Back to sign in" | always | `/auth/login` | |
| (auto-check) last digit | — | `OTP_LENGTH` digits entered (4 now) | screen 3 | error, boxes cleared, first box focused |
| Resend code | role button "Resend code" | 30 s after opening / last resend; not while checking or sending | toast "New code sent"; boxes cleared; countdown 30 s | red banner (API message or "Failed to resend the code."); 403 → session expired |
| ← Back to forgot password (screen 2) | role link/button | always | `/auth/forgot-password` ⚠ D11 (story: Login) | |
| Set password | role button "Set password" | always, except while saving ("Saving…") | toast "Password set"; `/auth/login` | field errors, or banner + toast "Couldn't set password" |
| ← Back to sign in (screen 3) | role link/button | always | `/auth/login` | |

## 7. Messages (required)
| Key | Where shown | Test ID | Exact text |
| --- | ----------- | ------- | ---------- |
| fp-email-required | under Email (screen 1) | `role="alert"` | Enter your email address |
| fp-email-invalid | under Email (screen 1) | `role="alert"` | Enter a valid email address |
| fp-api-error | red banner (screen 1) | `role="alert"` | API message, or "Something went wrong. Please try again." |
| code-checking | under the code | | Verifying… |
| code-invalid | under the code | `role="alert"` | Invalid verification code. Please try again. ⚠ D7 built: "Incorrect code entered. Please try again." |
| session-expired | red banner (screen 2) | `role="alert"` | Your session has expired. Redirecting to sign in… |
| resend-failed | red banner (screen 2) | `role="alert"` | API message, or "Failed to resend the code." |
| resend-ok | success toast | toast | New code sent — "Check {email} for a fresh {OTP_LENGTH}-digit code." (now "4-digit") |
| new-password-required | under New password | `role="alert"` | Please enter a new password. ⚠ D8 built: "Enter a new password." |
| password-rules | under New password | `role="alert"` | Password does not meet the required criteria. ⚠ D9 built: "Your new password doesn't meet all the requirements yet." |
| confirm-required | under Confirm password | `role="alert"` | Please confirm your new password. |
| password-mismatch | under Confirm password | | Passwords do not match. Please try again. ⚠ D10 built: live hint "Both passwords have to match" |
| passwords-match | under Confirm password | | Both passwords match |
| reset-failed | red banner + error toast | `role="alert"` / toast | Couldn't set password — API message, or "Something went wrong. Please try again." |
| reset-ok | success toast | toast | Password set — "You can now sign in with your new password." |

## 8. Business rules
- BR1: The code is exactly `OTP_LENGTH` digits (4 now with the fixed QA code; 6 once email is implemented); only
  digits can be entered. Tests take the length from `OTP_LENGTH`, so switching to 6 is a `.env` change, not a code change.
- BR2: Only the newest code is valid; each resend invalidates earlier codes.
- BR3: Resend is disabled for 30 s after the screen opens and after each resend; no limit in the UI (the backend may
  rate-limit per IP).
- BR4: Password rules (same as the signed-in "Change password" dialog): at least 8 characters, an uppercase letter, a
  lowercase letter, a number, a special character.
- BR5: The reset session id in the URL authorises screens 2 and 3; when it expires the API returns 403.
- BR6: A successful reset signs out other sessions using the old password.
- BR7: After a reset, the new password works and the old one doesn't.

## 9. UI states
- Loading: "Sending…" (screen 1, resend), "Verifying…" (code), "Saving…" (set password); buttons disabled meanwhile
- Countdown: "Resend code" disabled with "in Ns" from 30 to 0
- Error: red banners and toasts as in section 7
- Disabled / read-only conditions: as in section 6

## 10. APIs (for test setup, cleanup and mocking)
The calls run on the Next.js server, so they don't appear in the browser's Network tab and **can't be mocked with
`act.mockApi`**. Error banners (API errors, 403 session expired) stay manual unless the developers provide a trigger.
| Method | Endpoint | Purpose | Success | Errors |
| ------ | -------- | ------- | ------- | ------ |
| POST | `admin/auth/password/forgot` | Send the code (`{ email }`) | `{ session_id }` | API message |
| POST | `admin/auth/password/otp/verify` | Check the code (`{ session_id, otp }`) | `{ session_id }` | wrong code; 403 = session expired |
| POST | `admin/auth/password/otp/resend` | New code (`{ session_id }`) | — | 403 = session expired |
| POST | `admin/auth/password/reset` | Set the password (`{ session_id, password, confirmNewPassword }`) | — | API message |

## 11. Test data & accounts (required)
| Purpose | Username / data | Password / secret (.env variable) | Notes |
| ------- | --------------- | --------------------------------- | ----- |
| Account whose password is reset | `SUPERADMIN_EMAIL` | `SUPERADMIN_PASSWORD` | The only admin account; also used by every other test |
| Verification code (staging) | `OTP_CODE` (currently 1234) | — | Fixed QA-only code for the QA admin account until email is set up |
| Code length | `OTP_LENGTH` (currently 4) | — | Becomes 6 when email is implemented |
| Invalid code | any other `OTP_LENGTH` digits | — | e.g. 0000 now |
| Temporary new password | generated, meets the 5 rules | — | Used only inside the successful-reset test |

- **Only one account**: most forgot-password cases never complete a reset (screen 1 validation, wrong code, resend
  timer, set-password validation, Back links), so they don't change the password and run with everything else.
- **The successful reset** (AC22, AC25–AC27) changes the Super Admin password **and signs out other sessions**
  (BR6), so every saved login of other tests becomes invalid. That test:
  1. resets to a temporary password, checks login with it works and the old one doesn't,
  2. runs forgot password again and sets the password **back to `SUPERADMIN_PASSWORD`** (registered as cleanup),
  3. runs on its own, **after** all other tests (separate tag), followed by `npm run auth` to refresh saved logins.
- Restoring the old password only works if reusing it is allowed (open question). If not, this test stays manual until
  there is a second admin account; the developers recommend one too.
- If a run stops between step 1 and 2, reset the password by hand to `SUPERADMIN_PASSWORD`.
- OTP / captcha / email: **email is not set up on staging; the API accepts `OTP_CODE` (1234) for the QA admin.**
  Tests read it with `requireEnv('OTP_CODE')`, never hard-coded. Not automatable while the code is fixed: email
  delivery and content, AC13 (only the newest code valid). They stay `Automate: later` until real emails reach the
  Gmail test inbox (docs/otp-email-testing.html).

## 12. Mobile only
Not applicable (web).

## 13. Out of scope / known issues
- Differences waiting for a PO decision (sprints/sprint-01.md): D6 email screen added, D7–D10 message texts,
  D11 Back from the code screen, D13 email not trimmed on screen 1, D16 unregistered-email message reveals admin accounts.
- Planned change (D12): once email is implemented the code becomes **6 digits** (the panel on `/auth/forgot-password`
  already says "six-digit"). Then: update the Jira story (it says 4), set `OTP_LENGTH=6`, remove `OTP_CODE` and read
  codes from the Gmail test inbox (`mailbox.otpFrom(email, { length: 6 })`), and run `/qa-update` on this file.
- Still open: code / reset-session expiry time; can the old password be reused; is 1234 accepted only on QA;
  a second admin account for reset tests.

## 14. Change log
| Date | Change | By |
| ---- | ------ | -- |
| 2026-10-07 | Drafted from the Jira story, before the build; test IDs TBD; fixed code 1234 noted | QA Team |
| 2026-10-07 | Only one Super Admin account: reset tests restore SUPERADMIN_PASSWORD and run alone | QA Team |
| 2026-10-07 | Merged developer notes (from-dev/2026-10-07): 3 screens, URLs, selectors, password rules, toasts, APIs; differences D6–D15 marked | QA Team |
| 2026-10-07 | Checked on staging v0.2.0: screen 1 texts confirmed; unregistered email message found (D16) | QA Team |
| 2026-10-07 | Code length: 4 digits now (fixed QA code), 6 after email is implemented; D12 is a planned change, not a bug | QA Team |
