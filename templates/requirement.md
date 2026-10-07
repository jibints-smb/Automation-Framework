# <JIRA-KEY> — <Module / story title>

<!--
  Module specification for test automation. Developer + QA fill this in per module/story.
  Save as requirements/<web|mobile>/<JIRA-KEY>-<module>.md, then run /qa-testcases on it.
  Full guide with a worked example: docs/QA-Automation-Guide.pdf
  Sections marked (required) must be complete before QA starts (Definition of Ready).
-->

## 1. Overview (required)
| Item              | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| Jira              | <JIRA-KEY>                                             |
| Epic              | <Epic / product area>                                  |
| Module            | <Module name>                                          |
| Platform          | web / mobile-web / android / ios                       |
| Environment / URL | <QA URL + path, e.g. https://qa.app.com/register>      |
| Build / version   | <web build or app version; APK/IPA link for mobile>    |
| Feature flag      | <flag name + how to enable, or "none">                 |
| Priority          | blocker / critical / normal / minor                    |
| Developer / QA    | <names>                                                |

## 2. User story (required)
As a <role>, I want <goal> so that <benefit>.

## 3. Acceptance criteria (required)
<!-- Numbered, testable, Given/When/Then. Exact texts in quotes. -->
1. **AC1** Given ..., when ..., then ...
2. **AC2** ...

## 4. Entry point & preconditions (required)
- How to reach the screen: <menu path / URL / deep link>
- User role(s) that can access it: <role>
- Data that must exist first: <e.g. at least one product in catalogue>

## 5. Fields (required)
<!--
  Type: text, password, email, number, textarea, date, dropdown, checkbox, radio, file, button, link, label
  Test ID: value of data-testid (web) / accessibility id (mobile). Must be stable and unique.
-->
| # | Field | Type | Test ID | Required | Default | Rules (length, format, range, options) | Depends on | Error message (exact text) |
| - | ----- | ---- | ------- | -------- | ------- | -------------------------------------- | ---------- | -------------------------- |
| 1 |       |      |         |          |         |                                        |            |                            |

## 6. Actions & outcomes (required)
| Action (button/link) | Test ID | Enabled when | On success | On failure |
| -------------------- | ------- | ------------ | ---------- | ---------- |
|                      |         |              |            |            |

## 7. Messages (required)
<!-- Every toast, banner, dialog, empty state. Exact text, including punctuation. -->
| Key | Where shown | Test ID | Exact text |
| --- | ----------- | ------- | ---------- |
|     |             |         |            |

## 8. Business rules
- BR1: <calculations, permissions per role, limits, conditional behaviour>

## 9. UI states
- Loading: <spinner test id / behaviour>
- Empty: <text>
- Error (server down / 500): <text>
- Disabled / read-only conditions: <...>

## 10. APIs (for test setup, cleanup and mocking)
| Method | Endpoint | Purpose | Success | Errors |
| ------ | -------- | ------- | ------- | ------ |
|        |          |         |         |        |

## 11. Test data & accounts (required)
<!-- Never paste real passwords here: give the .env variable name instead. -->
| Purpose | Username / data | Password / secret (.env variable) | Notes |
| ------- | --------------- | --------------------------------- | ----- |
|         |                 |                                   |       |

- Cleanup: <how created data is removed / reset>
- OTP / captcha / email: <test bypass, fixed OTP, or test inbox (the framework reads a Gmail/Outlook test inbox: MAIL_* settings); OTP length and expiry time>

## 12. Mobile only
| Item                        | Android                    | iOS                     |
| --------------------------- | -------------------------- | ----------------------- |
| App build                   | <.apk link>                | <.ipa/.app link>        |
| Package / bundle id         | <com.company.app>          | <com.company.app>       |
| Launch activity             | <.MainActivity>            | n/a                     |
| Min OS / test devices       |                            |                         |
| Permissions asked           |                            |                         |
| Deep link to this screen    |                            |                         |

## 13. Out of scope / known issues
-

## 14. Change log
| Date | Change | By |
| ---- | ------ | -- |
|      |        |    |
