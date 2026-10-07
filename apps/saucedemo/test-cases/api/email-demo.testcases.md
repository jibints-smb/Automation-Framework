# Test cases — Email testing demo

| Item        | Value                                   |
| ----------- | --------------------------------------- |
| Source      | Framework example: email testing practice (no requirement MD; a demo sender plays the app) |
| Jira        | —                                       |
| Epic        | Platform                                |
| Feature     | Email testing demo                      |
| Platform    | api                                     |
| Spec file   | tests/api/demo/email-demo.spec.ts       |

## Preconditions
- Test mailbox set up: MAIL_USER / MAIL_PASSWORD in apps/saucedemo/.env, `npm run mail:check` passes.
- Run with `npm run demo:email` (tagged @demo, left out of every other run).

## Test cases
| ID             | Title                                              | Type     | Priority | Tags                 | Steps                                                      | Expected result                                                               | Automate |
| -------------- | -------------------------------------------------- | -------- | -------- | -------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- | -------- |
| TC-MAILDEMO-01 | Verification email arrives with the right content  | positive | normal   | @demo                | 1. App sends the verification code email to a new address  | Arrives within 60 s; from "Demo Shop"; subject correct; greets the user by name; no template placeholders | yes      |
| TC-MAILDEMO-02 | One-time code is read from the email               | positive | normal   | @demo                | 1. App sends a code 2. Read the code from the email        | The code read is the code sent, not the other numbers in the email           | yes      |
| TC-MAILDEMO-03 | Resend: the newest code is read                    | positive | normal   | @demo                | 1. App sends a code 2. App sends a new code (resend)       | The second email's code is read, and it differs from the first               | yes      |
| TC-MAILDEMO-04 | Confirmation link is read from the email           | positive | normal   | @demo                | 1. App sends a confirmation link email                     | The confirm link is read (not the unsubscribe link)                          | yes      |
| TC-MAILDEMO-05 | Correct code from the email is accepted            | positive | critical | @demo                | 1. App sends a code 2. Read it from the email 3. Enter it  | App answers "Verified"                                                        | yes      |
| TC-MAILDEMO-06 | Wrong code is rejected                             | negative | critical | @demo                | 1. App sends a code 2. Enter the code with one digit changed | App answers "Invalid code"                                                  | yes      |
| TC-MAILDEMO-07 | Old code no longer works after resend              | negative | normal   | @demo                | 1. App sends a code 2. Resend 3. Enter the first code 4. Enter the second code | First code: "Invalid code"; second code: "Verified"         | yes      |
| TC-MAILDEMO-08 | Code can be used only once                         | negative | normal   | @demo                | 1. App sends a code 2. Enter it 3. Enter it again          | First: "Verified"; second: "Code already used"                               | yes      |
| TC-MAILDEMO-09 | Expired code is rejected                           | negative | normal   | @demo                | 1. App sends a code with a 0 s expiry (QA setting) 2. Enter it | App answers "Code expired"                                                | yes      |

<!-- Type: positive, negative, boundary, ui, security, api, accessibility, visual, performance. Automate: yes / no (manual only) / later -->

## Change history
| Date       | Requirement change                                         | Test cases                      |
| ---------- | ---------------------------------------------------------- | ------------------------------- |
| 2026-10-07 | Demo app now also checks codes (valid / invalid / expired / used) | Added TC-MAILDEMO-05 to 09 |
