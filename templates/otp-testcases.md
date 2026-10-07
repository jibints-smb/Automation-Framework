# OTP / email verification: standard test cases

<!--
  Copy the rows you need into the module's test-cases file (e.g. test-cases/web/signup.testcases.md) when a
  requirement has an OTP, verification-code or verification-link step. Then:
    - replace <MOD> with the module code (TC-SIGNUP-..) and renumber from that file's next free ID
    - replace every <...> with the exact value from the requirement (messages, lengths, limits)
    - delete rows that don't apply, and say why in the review (e.g. "no resend button")
  "How to automate" shows which mailbox call does it; delete that column after copying (the file keeps the
  standard columns of templates/testcases.md). Guide: docs/otp-email-testing.html
-->

## Preconditions
- Test inbox set up for the app: `MAIL_USER` / `MAIL_PASSWORD` in `apps/<app>/.env`, `npm run mail:check` passes.
- Each test uses a new address: `mailbox.newAddress('<label>')`.
- For expiry / limit cases: a short OTP expiry or lower limits on the QA environment (ask the developers), or the case
  stays `Automate: later`.

## Test cases
| ID          | Title | Type | Priority | Tags | Steps | Expected result | Automate | How to automate |
| ----------- | ----- | ---- | -------- | ---- | ----- | --------------- | -------- | --------------- |
| TC-<MOD>-01 | OTP email arrives | positive | critical | @smoke @regression | 1. Start <signup / login / reset> with a new email address | An email arrives within <60> s at that address | yes | `waitForEmail(address, { subject: '<subject words>' })` |
| TC-<MOD>-02 | OTP email has the right content | positive | normal | @regression | 1. Trigger the OTP email 2. Open it | From "<sender name>"; subject "<subject>"; greets the user by name; states the expiry "<10 minutes>"; no `{{placeholders}}`, "undefined" or "null" | yes | `expect(email.from/subject/text)...` |
| TC-<MOD>-03 | OTP has the expected format | positive | normal | @regression | 1. Trigger the OTP email 2. Read the code | The code has <6> digits | yes | `otpFrom(email, { length: <6> })` (letters or dashes: `{ pattern }`) |
| TC-<MOD>-04 | Correct OTP is accepted | positive | critical | @smoke @regression | 1. Trigger the OTP 2. Enter the code from the email 3. Submit | User reaches <next screen / "Account verified"> | yes | `otpFrom` → page action → `verify...` |
| TC-<MOD>-05 | Wrong OTP is rejected | negative | critical | @regression | 1. Trigger the OTP 2. Enter the code with one digit changed 3. Submit | Error "<exact message>"; user stays on the OTP screen | yes | change the last digit of the real code |
| TC-<MOD>-06 | Empty OTP is rejected | negative | normal | @regression | 1. Submit without a code | Submit disabled, or error "<exact message>" | yes | no email needed |
| TC-<MOD>-07 | OTP of wrong length is rejected | boundary | normal | @regression | 1. Enter <5> digits 2. Enter <7> digits | Error "<exact message>", or input limited to <6> | yes | no email needed |
| TC-<MOD>-08 | Letters in the OTP are rejected | negative | minor | @regression | 1. Type "12ab56" | Letters not accepted, or error "<exact message>" | yes | no email needed |
| TC-<MOD>-09 | Pasted OTP with spaces works | positive | minor | @regression | 1. Paste " <code> " with spaces | Spaces trimmed; code accepted | yes | `otpFrom`, fill with spaces |
| TC-<MOD>-10 | Old OTP rejected after resend | negative | critical | @regression | 1. Trigger the OTP 2. Click "Resend code" 3. Enter the first code | Error "<exact message>"; the second code works | yes | second email: `waitForEmail(address, { newerThan: first })` |
| TC-<MOD>-11 | Resend sends a new email | positive | normal | @regression | 1. Trigger the OTP 2. Click "Resend code" | A second email arrives with a different code | yes | `waitForEmail(..., { newerThan: first })` |
| TC-<MOD>-12 | Resend is limited | negative | normal | @regression | 1. Click "Resend code" again immediately | Button disabled for <30> s with a countdown, or error "<exact message>"; after <N> resends: "<limit message>" | yes | UI check; countdown with web-first assertions, never a sleep |
| TC-<MOD>-13 | OTP works only once | negative | normal | @regression | 1. Use the code successfully 2. Go back and use it again | Error "<exact message>" | yes | reuse the same code |
| TC-<MOD>-14 | Expired OTP is rejected | negative | critical | @regression | 1. Trigger the OTP 2. Wait past the expiry (<10> minutes) 3. Enter the code | Error "<exact message>"; resend offered | later | needs a short QA expiry or a test hook; never `waitForTimeout` |
| TC-<MOD>-15 | Too many wrong attempts lock the OTP | security | critical | @regression | 1. Enter a wrong code <5> times | After attempt <5>: "<lock message>"; the correct code is no longer accepted until <condition> | yes | loop of wrong codes, then the real one |
| TC-<MOD>-16 | OTP of another account is rejected | security | normal | @regression | 1. Trigger OTPs for address A and B 2. Enter B's code on A's screen | Error "<exact message>" | yes | two `newAddress` |
| TC-<MOD>-17 | OTP not exposed | security | normal | @regression | 1. Trigger the OTP 2. Check the URL, page source and API response of the request | The code appears only in the email | yes | check `page.url()` and the send-OTP API response body (no mock) |
| TC-<MOD>-18 | OTP screen is accessible | accessibility | normal | @regression @a11y | 1. Open the OTP screen | No WCAG violations; the input has a label | yes | `verify.accessible()` |
| TC-<MOD>-19 | Verification link works | positive | critical | @smoke @regression | 1. Trigger the email 2. Open the link in it | Account verified; user lands on <screen> | yes | `linkFrom(email, '/verify')` (link flows instead of a code) |
| TC-<MOD>-20 | Verification link works only once | negative | normal | @regression | 1. Open the link 2. Open it again | "<link already used / expired message>" | yes | open the same `linkFrom` link twice |

<!-- Type: positive, negative, boundary, ui, security, api, accessibility, visual, performance. Automate: yes / no (manual only) / later -->
