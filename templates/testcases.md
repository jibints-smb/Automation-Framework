# Test cases — <Module>

<!--
  Output of /qa-testcases, input of /qa-automate. Reviewed by QA before automation.
  Every row becomes one Playwright test titled "<ID> | <Title>" and tagged @<ID>.
  "Source" links this file to its requirement (path relative to apps/<app>/) for npm run req:status.
-->

| Item        | Value                                   |
| ----------- | --------------------------------------- |
| Source      | requirements/<web|mobile|api>/<JIRA-KEY>-<module>.md |
| Jira        | <JIRA-KEY>                              |
| Epic        | <Epic>                                  |
| Feature     | <Module>                                |
| Platform    | web / android / ios / mobile-web / api  |
| Spec file   | tests/<web|mobile|api>/<module>/<module>.spec.ts |

## Preconditions
- ...

## Test cases
| ID          | Title | Type     | Priority | Tags                 | Steps | Expected result | Automate |
| ----------- | ----- | -------- | -------- | -------------------- | ----- | --------------- | -------- |
| TC-<MOD>-01 |       | positive | critical | @smoke @regression   | 1. ... | ...            | yes      |
| TC-<MOD>-02 |       | negative | normal   | @regression          | 1. ... | ...            | yes      |

<!-- Type: positive, negative, boundary, ui, security, api, accessibility, visual, performance.
     Extra tag for the last four: @api @a11y @visual @perf. Automate: yes / no (manual only) / later / retired (removed from the requirement) -->

## Change history
<!-- Added by /qa-update when the requirement changes. Never renumber IDs; retire removed cases with Automate: retired (and delete their test). -->
| Date | Requirement change | Test cases |
| ---- | ------------------ | ---------- |
