# Sprint 01 — bergen-kids-admin-web

<!--
  QA's sprint tracker (copy of templates/sprint.md). Requirement and test-case files stay in requirements/ and
  test-cases/ (never move them per sprint: baselines are keyed by path).
  Developer MDs are saved unchanged in sprints/sprint-01/from-dev/<YYYY-MM-DD>/.
-->

| Item         | Value                       |
| ------------ | --------------------------- |
| Dates        | TBD → TBD                   |
| Goal         | Login and Forgot password tested and automated on staging |
| Platforms    | web                         |
| Environment  | https://stagingadminbergenkids.newagesmb.com |
| QA           | QA Team                     |

## Stories
<!-- Stage: drafted (req:status: "Not baselined") → cases → automated → signed-off (npm run req:status shows it). -->
| Jira    | Story                       | Platform | Requirement file                              | Test-cases file                              | Stage   | Automated | Notes |
| ------- | --------------------------- | -------- | --------------------------------------------- | -------------------------------------------- | ------- | --------- | ----- |
| BK-1 | Super Admin login           | web      | requirements/web/BK-1-login.md             | test-cases/web/login.testcases.md            | cases (32) | 26/26 (20 pass; 6 fail on D1–D3) | D1–D3, D5 open; sign-out with "Keep me signed in" ticked sometimes keeps the session (to raise) |
| BK-2 | Super Admin forgot password | web      | requirements/web/BK-2-forgot-password.md   | test-cases/web/forgot-password.testcases.md  | cases (46) | 31/31 (25 pass; 6 fail on D7–D11) | D6–D16 open; fixed code 1234; reset tests (TC-FP-35–37) wait for a 2nd admin account; the forgot-password API calls go from the browser (bergenapi…), so TC-FP-20/39 could be automated |

## Builds received
<!-- One row per build. Smoke: npm run test:smoke on the build; "rejected" stops testing until a new build. -->
| Date | Version | Platform | Stories / fixes | Dev MD folder | Smoke | Report |
| ---- | ------- | -------- | --------------- | ------------- | ----- | ------ |
| 2026-10-07 (received; build date not given) | v0.2.0 (page footer) | web | BK-1 done, BK-2 done | sprints/sprint-01/from-dev/2026-10-07/ | not run yet (no tests) | |

## Questions for the developers
<!-- Answers from the developer notes of 2026-10-07 recorded; "Ask again" rows still need an answer. -->
| Jira | Question | Answer | Outcome |
| ---- | -------- | ------ | ------- |
| BK-1 | Login page path and Admin Dashboard URL? | /auth/login → / (or callbackUrl) | In BK-1 |
| BK-1 | Lockout after N failed logins? | **Not mentioned** | Ask again |
| BK-1 | Password stored in local storage: intended? encrypted? | Intended by product; **plain text** | D5: security risk, ask PO |
| BK-1 | Exact texts "Forgot?", "Keep me signed in"? | "Forgot?", "Keep me signed in" | In BK-1 |
| BK-1 | Where does the login-failed message appear; button disabled while empty? | Error toast; button always enabled except while signing in | In BK-1 |
| BK-1 | Does "Keep me signed in" keep the session? | Yes: 30 days ticked, 1 day unticked | In BK-1 (AC17) |
| BK-1 | Captcha on staging? | Not mentioned (assumed none) | — |
| BK-1 / BK-2 | Test-ID attribute? | None yet; stable ids, roles and labels given | Locators by role / label / #id |
| BK-2 | When is the first code sent and to which email? | Screen 1: admin enters the email, then the code is sent | D6 |
| BK-2 | Code expiry time and the expired message? | Session expiry → 403 "Your session has expired…"; **duration not given** | Ask again |
| BK-2 | Password criteria; marked while typing? | 5 rules; each turns green | In BK-2 |
| BK-2 | Message for an empty code; success text? | No submit (auto-check at 4 digits); toast "Password set" | In BK-2 |
| BK-2 | Limit on wrong code attempts? | Not in the UI; backend may rate-limit per IP | In BK-2 |
| BK-2 | Back from the code screen; open steps by URL? | Back → forgot-password page; without URL params → login | D11; AC28 |
| BK-2 | Can the old password be reused? | **Not answered** | Ask again (needed for the reset test) |
| BK-2 | Does a reset end other sessions? | Yes | D14; reset test runs last, then npm run auth |
| BK-2 | When will real emails be enabled on staging? | **Not answered**; 1234 accepted for the QA admin | Ask again; confirm 1234 is QA-only |
| BK-2 | Second admin account for reset tests? | Developers recommend one | Ask who creates it |

## Differences found (QA draft vs. developer MD)
<!-- From npm run req:diff after merging. The Jira story stays the expected result until the PO decides. -->
| #   | Jira | Difference (story → build) | Proposed outcome | Decision |
| --- | ---- | -------------------------- | ---------------- | -------- |
| D1  | BK-1 | Validation texts "Please enter your email address." / "Please enter a valid email address." / "Please enter your password." → "Enter your email address" / "Enter a valid email address" / "Enter your password" | PO: fix the build (bug) or update the story | |
| D2  | BK-1 | "Keep me signed in" checked by default → unticked by default | PO decision | |
| D3  | BK-1 | Unticked keeps a previously saved login → unticked deletes it | PO decision | |
| D4  | BK-1 | Email and password stay filled after a failed login → not stated | Checked on staging: both stay filled | **Closed** (matches the story) |
| D5  | BK-1 | Password stored in **plain text** in localStorage (key bk-admin-remembered-login) | Security risk: PO / tech lead to confirm | |
| D6  | BK-2 | No email step in the story → screen 1 asks for the email | Accept (fills a gap in the story) | |
| D7  | BK-2 | "Invalid verification code. Please try again." → "Incorrect code entered. Please try again." | PO: fix build or story | |
| D8  | BK-2 | "Please enter a new password." → "Enter a new password." | PO: fix build or story | |
| D9  | BK-2 | "Password does not meet the required criteria." → "Your new password doesn't meet all the requirements yet." | PO: fix build or story | |
| D10 | BK-2 | "Passwords do not match. Please try again." on submit → live hint "Both passwords have to match" | PO: fix build or story | |
| D11 | BK-2 | Back from the code screen: story → Login; built → /auth/forgot-password | PO decision | |
| D12 | BK-2 | "six-digit" text on /auth/forgot-password; the code screen has 4 digits | **Not a bug**: 4 digits now (fixed 1234, no email); 6 digits once email is implemented. Interim text mismatch accepted | Update the Jira story to 6 digits when email goes live |
| D13 | BK-2 | Email on screen 1 not trimmed / lower-cased (login is) | Question: intended? | |
| D14 | BK-2 | Reset signs out other sessions (new information) | Accept; the reset test runs last | |
| D15 | BK-2 | Resend also disabled for 30 s when the screen opens | Accept | |
| D16 | BK-2 | Unregistered email on the forgot screen shows "No admin account found with that email address." (found on staging; not in story or dev notes) | Security: reveals which emails are admins. Suggest a neutral message ("If this email is registered, a code has been sent") | |

## Bugs raised
| Jira bug | Story | Severity | Status | Test (knownBug) |
| -------- | ----- | -------- | ------ | --------------- |
|          |       |          |        |                 |

## Sprint end
- [ ] `npm run test:regression` green (or every failure is a ticketed `knownBug`)
- [ ] `npm run coverage:tc`: every `Automate: yes` case automated
- [ ] `npm run req:status`: nothing CHANGED or NEW left
- [ ] Each story signed off: `npm run req:baseline -- <md> --stage signed-off --by "<name>"`

Signed off by: ________ on ________
