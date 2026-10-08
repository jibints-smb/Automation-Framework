# Sprint <NN> — <app>

<!--
  QA's sprint tracker, created by npm run sprint:new -- <NN> (with sprint-<NN>/manual-results.md).
  Requirement and test-case files stay in requirements/ and test-cases/ (never move them per sprint:
  baselines are keyed by path). This file records which stories, builds, questions and decisions belong to the sprint;
  npm run sprint:report -- <NN> reads its tables (keep the column names) for the PO sign-off report.
  Tag the sprint's runs: SPRINT=<NN> and BUILD_VERSION=<build> in the root .env (or on the command line).
  Developer MDs are saved unchanged in sprints/sprint-<NN>/from-dev/<YYYY-MM-DD>/.
-->

| Item         | Value                       |
| ------------ | --------------------------- |
| Dates        | <start> → <end>             |
| Goal         |                             |
| Platforms    | web / android / ios         |
| Environment  | <base URL>                  |
| QA           | <names>                     |

## Stories
<!-- Stage: drafted (req:status: "Not baselined") → cases → automated → signed-off (npm run req:status shows it).
     npm run test:story -- <Jira> runs one story; npm run test:sprint -- <NN> runs all of them. -->
| Jira | Story | Platform | Requirement file | Test-cases file | Stage | Automated | Notes |
| ---- | ----- | -------- | ---------------- | --------------- | ----- | --------- | ----- |
|      |       | web      | requirements/web/<JIRA>-<module>.md | test-cases/web/<module>.testcases.md | drafted | 0/0 | |

## Builds received
<!-- One row per build. Smoke: npm run test:smoke with BUILD_VERSION=<version>; "rejected" stops testing until a new build. -->
| Date | Version | Platform | Stories / fixes | Dev MD folder | Smoke | Report |
| ---- | ------- | -------- | --------------- | ------------- | ----- | ------ |
|      |         |          |                 | sprints/sprint-<NN>/from-dev/<YYYY-MM-DD>/ | accepted / rejected | reports/<app>/... |

## Questions for the developers
<!-- "Ask again" / "Not answered" rows are listed as open in the sprint report. -->
| Jira | Question | Answer | Outcome |
| ---- | -------- | ------ | ------- |
|      |          |        |         |

## Differences found (QA draft vs. developer MD)
<!-- From npm run req:diff after merging. The Jira story stays the expected result until the PO decides:
     the failing test gets pendingDecision('Dn', '...'). Decision: "Closed", "Accept" (→ /qa-update) or the Jira bug
     key (→ knownBug). Rows without a decision are listed as waiting for the PO in the sprint report. -->
| #   | Jira | Difference (story → build) | Proposed outcome | Decision |
| --- | ---- | -------------------------- | ---------------- | -------- |
| D1  |      |                            |                  |          |

## Bugs raised
| Jira bug | Story | Severity | Status | Test (knownBug) |
| -------- | ----- | -------- | ------ | --------------- |
|          |       |          |        |                 |

## Sprint end
- [ ] `npm run test:sprint -- <NN>` (or `test:regression`) green, every failure a ticketed `knownBug`
- [ ] Manual results recorded in `sprint-<NN>/manual-results.md` for the cases that aren't automated
- [ ] `npm run trace:check`: no errors · `npm run req:status`: nothing CHANGED or NEW left
- [ ] `npm run sprint:report -- <NN>`: "Ready for sign-off"; send the report to the PO
- [ ] Each story signed off: `npm run req:baseline -- <md> --stage signed-off` (refused while something is open)

Signed off by: ________ on ________
