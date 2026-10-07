# What to send QA with every build

<!--
  Send this checklist to the developers once, at the start of the project.
  QA saves what they send, unchanged, in apps/<app>/sprints/sprint-NN/from-dev/<YYYY-MM-DD>/
  and merges it into apps/<app>/requirements/ (see docs/Getting-Started-Guide.pdf, "Working in sprints").
-->

## 1. One MD file per user story
Any format is fine. Name it `<JIRA-KEY>-<short-name>.md` (e.g. `PRJ-101-login.md`) and, for a story built for both
web and mobile, say which platform(s) the notes cover. Please include:

- [ ] Jira key and story title
- [ ] Acceptance criteria **as implemented** (not only as planned)
- [ ] Where the screen is: URL / menu path / deep link, and which user roles can open it
- [ ] Fields: name, type, required or not, rules (length, format, range, options), default value
- [ ] Buttons and links: when they are enabled, what happens on success and on failure
- [ ] Every message the user can see (errors, toasts, dialogs, empty states), **exact text**
- [ ] Business rules: calculations, limits, permissions per role
- [ ] APIs the screen calls (method, endpoint), if QA can use them to create or delete test data
- [ ] What changed since the last build you sent for this story
- [ ] Optional but very helpful: the `data-testid` (web) / accessibility id (mobile) of each field, button and message

## 2. Build details (in the message or a `build.md`)
| Item                         | Value                                                     |
| ---------------------------- | --------------------------------------------------------- |
| Build date / version         |                                                           |
| Platform(s)                  | web / android / ios                                       |
| QA URL                       |                                                           |
| Mobile build                 | APK link / TestFlight or IPA link, package / bundle id    |
| Stories included             | <JIRA-KEY>: done / partial (what is missing)              |
| Bug fixes included           | <JIRA-KEY>, ...                                           |
| Known issues / not testable  |                                                           |
| Feature flags                | <flag>: how to switch on, or "none"                       |
| DB / config changes          | new roles, seed data, migrations                          |

## 3. Credentials QA needs
**Never put passwords inside the MD files.** Share them through the password manager (or another secure channel
agreed with QA). QA stores them only in the framework's `.env` file, which is never committed.

- [ ] One test account per user role used by the stories (e.g. user, admin, supervisor)
- [ ] Accounts in specific states, if a story needs them (locked, unverified, expired subscription, ...)
- [ ] OTP / email verification: a fixed QA-only OTP, a bypass, or confirmation that OTPs go to the QA test inbox
- [ ] Captcha: disabled on QA, or a test key
- [ ] API keys / tokens QA needs to create or clean up test data
- [ ] Payment / third-party sandbox details, if used

New role or new account? Tell QA in the build details, so the automated logins are updated before testing starts.
