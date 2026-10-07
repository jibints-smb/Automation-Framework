# Sprint <NN> — <app>

<!--
  QA's sprint tracker. Copy to apps/<app>/sprints/sprint-<NN>.md at sprint planning.
  Requirement and test-case files stay in requirements/ and test-cases/ (never move them per sprint:
  baselines are keyed by path). This file only records which stories and builds belong to the sprint.
  Developer MDs are saved unchanged in sprints/sprint-<NN>/from-dev/<YYYY-MM-DD>/.
-->

| Item         | Value                       |
| ------------ | --------------------------- |
| Dates        | <start> → <end>             |
| Goal         |                             |
| Platforms    | web / android / ios         |
| QA           | <names>                     |

## Stories
<!-- Stage: drafted (req:status: "Not baselined") → cases → automated → signed-off (npm run req:status shows it). -->
| Jira | Story | Platform | Requirement file | Test-cases file | Stage | Automated | Notes |
| ---- | ----- | -------- | ---------------- | --------------- | ----- | --------- | ----- |
|      |       | web      | requirements/web/<JIRA>-<module>.md | test-cases/web/<module>.testcases.md | drafted | 0/0 | |

## Builds received
<!-- One row per build. Smoke: npm run test:smoke on the build; "rejected" stops testing until a new build. -->
| Date | Version | Platform | Stories / fixes | Dev MD folder | Smoke | Report |
| ---- | ------- | -------- | --------------- | ------------- | ----- | ------ |
|      |         |          |                 | sprints/sprint-<NN>/from-dev/<YYYY-MM-DD>/ | accepted / rejected | reports/<app>/... |

## Differences found (QA draft vs. developer MD)
<!-- From npm run req:diff after merging. Question → answer → outcome (requirement updated / bug raised). -->
| Jira | Difference | Question to dev | Outcome |
| ---- | ---------- | --------------- | ------- |
|      |            |                 |         |

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
