# Test cases — Advertiser Accounts

<!--
  Output of /qa-testcases, input of /qa-automate. Reviewed by QA before automation.
  Every row becomes one Playwright test titled "<ID> | <Title>" and tagged @<ID>.
  "Source" links this file to its requirement (path relative to apps/<app>/) for npm run req:status.
  Built from QA's BK-7 test specification (the requirement). The original IDs (TC_DASH_001 …) are listed under
  "Original IDs". Expected results follow the requirement; where the developers' notes of 2026-10-08
  (sprints/sprint-01/from-dev/2026-10-08/advertiser-accounts.md, not merged yet) describe something else, it is a
  question below, decided after /qa-merge (sprint Differences table), not changed here.
-->

| Item        | Value                                                   |
| ----------- | ------------------------------------------------------- |
| Source      | requirements/web/BK-7-advertiser-accounts.md            |
| Jira        | BK-7                                                    |
| Epic        | User management                                         |
| Feature     | Advertiser Accounts                                     |
| Platform    | web                                                     |
| Spec file   | tests/web/advertiser-accounts/advertiser-accounts.spec.ts |

## Preconditions
- Signed in as Super Admin (saved login of the `superadmin` role). Page: sidebar "Advertiser Accounts" (`/advertisers` per the developer notes).
- Advertisers can't be created in the admin panel (they sign up on the website / app): tests use **seeded QA advertisers**:
  an approved one with a known company name and email (block / unblock, search, picker); a pending one and a
  disposable one, **re-seeded before each run** (approve and delete can't be undone). Settings (names from the
  developer notes): `QA_ADV_APPROVED_EMAIL`, `QA_ADV_APPROVED_COMPANY`, `QA_ADV_PENDING_EMAIL`, `QA_ADV_DELETE_EMAIL`.
- Data for list checks: a mix of Pending, Approved and Blocked advertisers, more than 10 in total (pagination).
- Actions that change data (approve, block / unblock, delete) change shared counts and the sidebar badge: run serially.
- Counts, names and dates are read from the page, never hard-coded.

## Test cases
| ID         | Title | Type | Priority | Tags | Steps | Expected result | Automate |
| ---------- | ----- | ---- | -------- | ---- | ----- | --------------- | -------- |
| TC-ADV-01 | Summary cards show Total, Approved, Pending and Total revenue | ui | high | @regression | 1. Open Advertiser Accounts | Summary cards "Total Advertisers", "Approved", "Pending" and "Total Revenue" are shown; Total Revenue shows 0 (Sprint 1) | yes |
| TC-ADV-02 | Pending badge shows the exact count up to 10 | positive | high | @regression | 1. Open Advertiser Accounts 2. Read the badge beside "Advertiser Accounts" in the left menu and the Pending card | With 10 or fewer pending advertisers the badge shows the exact number (e.g. "5"), equal to the Pending card | yes |
| TC-ADV-03 | Pending badge shows "10+" above 10 | boundary | high | @regression | 1. With 11 pending advertisers, read the left-menu badge | Badge shows "10+" instead of 11 | later |
| TC-ADV-04 | Pending badge shows "10" at exactly 10 | boundary | normal | @regression | 1. With exactly 10 pending advertisers, read the left-menu badge | Badge shows "10" (the "10+" form starts above 10) | later |
| TC-ADV-05 | Badge and Pending card update right after an approval | positive | high | @regression | 1. Note the Pending card and badge 2. Approve one pending advertiser 3. Read them again without reloading | Pending count and badge drop by 1 and Approved rises by 1 immediately, without a manual page reload | later |
| TC-ADV-06 | Listing shows every required column | ui | high | @smoke @regression | 1. Open Advertiser Accounts 2. Check the table columns and a row | Columns: avatar (initials / picture), name with address and website link, contact person (name, email, phone), joined date, count of ads (0 in Sprint 1), revenue (0 in Sprint 1), status, actions | yes |
| TC-ADV-07 | Newest joined advertisers come first | positive | normal | @regression | 1. Open Advertiser Accounts 2. Read the joined dates down the table | Rows are sorted by joined date, latest on top | yes |
| TC-ADV-08 | Total count and pagination | positive | normal | @regression | 1. With more than 10 advertisers, read the total label 2. Go to the next and back to the previous page | The total number of records is shown; 10 rows per page; next / previous load the right pages | yes |
| TC-ADV-09 | Search by advertiser name | positive | high | @regression | 1. Type part of a known advertiser's name in the search box | The table updates to the matching advertiser | yes |
| TC-ADV-10 | Search by email, part or full | positive | high | @regression | 1. Search the domain of a known advertiser's email 2. Search the full email | Both show the matching advertiser | yes |
| TC-ADV-11 | Search by part of a phone number | positive | high | @regression | 1. Search 6 consecutive digits of a known advertiser's phone | The advertiser with that phone number is shown | yes |
| TC-ADV-12 | Search matches partial words and handles letter case as specified | positive | normal | @regression | 1. Search part of a name 2. Search the same text in different letter case | Partial keywords match; letter case is handled as specified (rule to confirm, see questions) | later |
| TC-ADV-13 | Search without a match shows the empty message | negative | normal | @regression | 1. Search a text no advertiser has (e.g. "NonExistentX…") | The table shows "No advertiser accounts found." | yes |
| TC-ADV-14 | Filter by status | positive | high | @regression | 1. Choose "Pending" 2. "Approved" 3. "Blocked" 4. "All Statuses" | Each filter shows only advertisers with that status; "All Statuses" shows all | yes |
| TC-ADV-15 | Filter by one advertiser | positive | normal | @regression | 1. Choose a known advertiser in the advertiser filter | Only that advertiser's record is shown | yes |
| TC-ADV-16 | Status, advertiser and search filters work together | positive | high | @regression | 1. Status "Approved" 2. Choose an advertiser 3. Type a keyword of that advertiser | Only records that meet all three criteria are shown | yes |
| TC-ADV-17 | A pending advertiser can only be approved or deleted | ui | high | @regression | 1. Find a pending advertiser 2. Look at its actions | Only Approve (✓) and Delete are offered | yes |
| TC-ADV-18 | Approve a pending advertiser | positive | critical | @smoke @regression | 1. Click Approve (✓) on a pending advertiser | Status changes to Approved immediately; Pending count −1, Approved count +1; left-menu badge updates | later |
| TC-ADV-19 | An approved advertiser can only be blocked or deleted | ui | high | @regression | 1. Find an approved advertiser 2. Look at its actions | Only Block and Delete are offered | yes |
| TC-ADV-20 | Block an approved advertiser after confirming | positive | critical | @regression | 1. Click Block on an approved advertiser 2. Read the dialog 3. Confirm 4. Unblock again (restores the data) | Dialog says "<Advertiser name> will lose access immediately. You can unblock them at any time."; after confirming the status is Blocked | yes |
| TC-ADV-21 | A blocked advertiser loses access on the website and the app immediately | security | critical | @regression | 1. Sign the advertiser in on the website and the mobile app 2. Block them in the admin panel 3. Use both sessions | Both sessions end at once; the advertiser can't sign in again | no |
| TC-ADV-22 | A blocked advertiser can only be unblocked or deleted | ui | high | @regression | 1. Find a blocked advertiser 2. Look at its actions | Only Unblock and Delete are offered | yes |
| TC-ADV-23 | Unblock a blocked advertiser | positive | high | @regression | 1. Block a known approved advertiser 2. Click Unblock | Status returns to Approved; the advertiser can sign in again | yes |
| TC-ADV-24 | Unblocking is recorded in the audit log | positive | high | @regression | 1. Unblock an advertiser 2. Open the audit log | An entry records the unblock (who, which advertiser, when) | later |
| TC-ADV-25 | Delete an advertiser after confirming | positive | critical | @regression | 1. Click Delete on the disposable advertiser 2. Read the dialog 3. Confirm | Dialog says "<Advertiser name> will be permanently removed. This cannot be undone."; the account is deleted and no longer listed | later |
| TC-ADV-26 | A deleted advertiser who is signed in is logged out immediately | security | critical | @regression | 1. Sign the advertiser in on the website 2. Delete them in the admin panel 3. Use the session | The session ends at once and the account can't sign in | no |
| TC-ADV-27 | Cancelling Block or Delete changes nothing | negative | normal | @regression | 1. Click Block, then Cancel 2. Click Delete, then Cancel / close | The dialogs close; status and account stay unchanged | yes |
| TC-ADV-28 | Export the full list to CSV | positive | high | @regression | 1. Without search or filters, click Export | A .csv file downloads with all advertisers and the right headers and data | yes |
| TC-ADV-29 | Export only the filtered results | positive | high | @regression | 1. Filter Status = "Blocked" 2. Click Export | The downloaded CSV contains only the filtered advertisers | yes |
| TC-ADV-30 | Export with no records shows a message and downloads nothing | negative | normal | @regression | 1. Search a text with no match 2. Click Export | Message "There are no advertiser accounts available to export."; no file is downloaded | yes |
| TC-ADV-31 | Advertiser Accounts page is accessible | accessibility | normal | @regression @a11y | 1. Open Advertiser Accounts | The page meets WCAG 2.1 AA (no serious or critical violations) | yes |
| TC-ADV-32 | Advertiser Accounts page loads fast | performance | normal | @regression @perf | 1. Open Advertiser Accounts | The page loads within the app's page-load budget (app.config.ts `checks`) | yes |

<!-- Type: positive, negative, boundary, ui, security, api, accessibility, visual, performance.
     Extra tag for the last four: @api @a11y @visual @perf. Automate: yes / no (manual only) / later / retired (removed from the requirement) -->

Automate notes:
- TC-ADV-03, 04 `later`: need an exact number of pending advertisers on QA (10, then 11), which the tests can't create (advertisers sign up on the website / app). Automatable once QA has a seeding step.
- TC-ADV-05, 18 `later`: approving can't be undone; each run needs a freshly seeded pending advertiser (`QA_ADV_PENDING_EMAIL`).
- TC-ADV-25 `later`: delete is permanent; each run needs a freshly seeded disposable advertiser (`QA_ADV_DELETE_EMAIL`).
- TC-ADV-12 `later`: the expected letter-case rule isn't specified (see questions).
- TC-ADV-24 `later`: where the audit log is shown isn't specified.
- TC-ADV-21, 26 `no`: need the advertiser's own website and mobile-app sessions (other products, outside this admin app): tested by hand.
- TC-ADV-20, 23 use a known approved advertiser (`QA_ADV_APPROVED_EMAIL`) and unblock it again at the end.

## Original IDs
| Spec ID | Test case |
| ------- | --------- |
| TC_DASH_001 | TC-ADV-01 |
| TC_DASH_002 | TC-ADV-02 |
| TC_DASH_003 | TC-ADV-03 (TC-ADV-04 added: boundary at exactly 10) |
| TC_DASH_004 | TC-ADV-05 |
| TC_LIST_001 | TC-ADV-06 |
| TC_LIST_002 | TC-ADV-07 |
| TC_LIST_003 | TC-ADV-08 |
| TC_SRCH_001 | TC-ADV-09 |
| TC_SRCH_002 | TC-ADV-10 |
| TC_SRCH_003 | TC-ADV-11 |
| TC_SRCH_004 | TC-ADV-12 |
| TC_SRCH_005 | TC-ADV-13 |
| TC_FLTR_001 | TC-ADV-14 |
| TC_FLTR_002 | TC-ADV-15 |
| TC_FLTR_003 | TC-ADV-16 |
| TC_ACT_001 | TC-ADV-17 |
| TC_ACT_002 | TC-ADV-18 |
| TC_ACT_003 | TC-ADV-19 |
| TC_ACT_004 | TC-ADV-20 (block) + TC-ADV-21 (sessions end) |
| TC_ACT_005 | TC-ADV-23 (unblock) + TC-ADV-24 (audit log) |
| TC_ACT_006 | TC-ADV-25 (delete) + TC-ADV-26 (logged out) |
| TC_ACT_007 | TC-ADV-27 |
| TC_EXP_001 | TC-ADV-28 |
| TC_EXP_002 | TC-ADV-29 |
| TC_EXP_003 | TC-ADV-30 |
| (DoD: blocked advertisers can be unblocked) | TC-ADV-22 (added) |
| (non-functional) | TC-ADV-31, TC-ADV-32 (added) |

## Change history
<!-- Added by /qa-update when the requirement changes. Never renumber IDs; retire removed cases with Automate: retired (and delete their test). -->
| Date | Requirement change | Test cases |
| ---- | ------------------ | ---------- |
