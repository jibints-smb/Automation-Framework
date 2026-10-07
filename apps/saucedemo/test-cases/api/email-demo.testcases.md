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

<!-- Type: positive, negative, boundary, ui, security, api, accessibility, visual, performance. Automate: yes / no (manual only) / later -->

## Change history
