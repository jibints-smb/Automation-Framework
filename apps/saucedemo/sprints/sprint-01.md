# Sprint 01 — saucedemo

<!--
  EXAMPLE sprint tracker (copy of templates/sprint.md, filled in) for the demo app.
  Requirement and test-case files stay in requirements/ and test-cases/ (never move them per sprint:
  baselines are keyed by path). Developer MDs are saved unchanged in sprints/sprint-01/from-dev/<YYYY-MM-DD>/.
-->

| Item         | Value                       |
| ------------ | --------------------------- |
| Dates        | 2026-10-05 → 2026-10-16     |
| Goal         | Login and product browsing automated on web; mobile login test cases ready |
| Platforms    | web / android               |
| QA           | QA Team                     |

## Stories
<!-- Stage: drafted (req:status: "Not baselined") → cases → automated → signed-off (npm run req:status shows it). -->
| Jira      | Story                      | Platform | Requirement file                        | Test-cases file                        | Stage      | Automated | Notes |
| --------- | -------------------------- | -------- | --------------------------------------- | -------------------------------------- | ---------- | --------- | ----- |
| SCRUM-101 | User can log in            | web      | requirements/web/SCRUM-101-login.md     | test-cases/web/login.testcases.md      | signed-off | 5/5       |       |
| SCRUM-102 | Browse and add products    | web      | requirements/web/SCRUM-102-products.md  | test-cases/web/products.testcases.md   | signed-off | 8/8       |       |
| MOB-201   | User can log in (app)      | android  | requirements/mobile/MOB-201-login.md    | test-cases/mobile/login.testcases.md   | cases      | 2/2       | Waiting for the APK |

## Builds received
<!-- One row per build. Smoke: npm run test:smoke on the build; "rejected" stops testing until a new build. -->
| Date       | Version | Platform | Stories / fixes | Dev MD folder                         | Smoke    | Report |
| ---------- | ------- | -------- | --------------- | ------------------------------------- | -------- | ------ |
| 2026-10-15 | 1.0.0   | web      | SCRUM-101       | sprints/sprint-01/from-dev/2026-10-15/ | accepted | reports/saucedemo/… |

## Differences found (QA draft vs. developer MD)
<!-- From npm run req:diff after merging. Question → answer → outcome (requirement updated / bug raised). -->
| Jira      | Difference | Question to dev | Outcome |
| --------- | ---------- | --------------- | ------- |
| SCRUM-101 | Error box has a close (X) button `data-test=error-button`; not in QA's requirement | Intended? | Example only: would be accepted → `/qa-update` adds a test case |

## Bugs raised
| Jira bug | Story | Severity | Status | Test (knownBug) |
| -------- | ----- | -------- | ------ | --------------- |
| —        |       |          |        |                 |

## Sprint end
- [ ] `npm run test:regression` green (or every failure is a ticketed `knownBug`)
- [ ] `npm run coverage:tc`: every `Automate: yes` case automated
- [ ] `npm run req:status`: nothing CHANGED or NEW left
- [ ] Each story signed off: `npm run req:baseline -- <md> --stage signed-off --by "<name>"`

Signed off by: ________ on ________

---

## Practice: build day with the example developer note
The developer note for build 1.0.0 is in `sprints/sprint-01/from-dev/2026-10-15/SCRUM-101-login.md`.
Try the build-day steps on it, then undo them so the demo stays signed off.

1. Merge it. Ask Claude:
   ```
   Merge the developer notes in apps/saucedemo/sprints/sprint-01/from-dev/2026-10-15/SCRUM-101-login.md
   into apps/saucedemo/requirements/web/SCRUM-101-login.md. Keep the existing structure, add what is new,
   and add a Change log row "Merged dev notes, build 1.0.0". List every point where the notes differ.
   ```
2. Compare:
   ```
   npm run req:status                                                   # SCRUM-101 shows CHANGED
   npm run req:diff -- apps/saucedemo/requirements/web/SCRUM-101-login.md   # shows the close button
   ```
3. (Optional) `/qa-update apps/saucedemo/requirements/web/SCRUM-101-login.md` to see how the tests would change.
4. Undo everything:
   ```
   git restore apps/saucedemo/requirements apps/saucedemo/test-cases apps/saucedemo/models apps/saucedemo/pages apps/saucedemo/tests
   npm run req:status                                                   # all up to date again
   ```
