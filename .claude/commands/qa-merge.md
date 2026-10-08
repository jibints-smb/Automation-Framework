---
description: Merge a developer's MD (sprints/.../from-dev/) into QA's requirement file for that story
argument-hint: <path to apps/<app>/sprints/sprint-NN/from-dev/<date>/<file>.md>
---

The developers sent notes for a story: **$ARGUMENTS**. Merge them into QA's requirement file so the change can be
tested. QA's requirement (`apps/<app>/requirements/<web|mobile|api>/<JIRA>-<module>.md`) is the single source of
truth; the developer file is evidence and is **never edited**.

1. Read the developer MD. Find its story, in this order: a Jira key in the file name (e.g. `BK-2-...md`), the file's
   own `Jira` / `Jira key` row, or the module name: `advertiser-accounts.md` belongs to the requirement
   `<JIRA>-advertiser-accounts.md`. A key merely mentioned in the text (a reference to another story) doesn't count.
   If no requirement matches, stop and report it: QA writes the requirement from the Jira story first
   (`templates/requirement.md`), so the story stays the expected result.
2. Check the requirement has a baseline (`npm run req:status`). Without one, run
   `npm run req:baseline -- <requirement.md> --stage cases` first, so the merge shows up as a change in `req:diff`.
3. Merge into the requirement, keeping its template structure and section order:
   - Add what the developers made concrete: URLs, field ids/selectors, exact texts, messages, API endpoints, rules,
     limits, environment notes. Put each fact in the section the template has for it.
   - **Never replace the story's expected behaviour with the build's.** Where the build differs from the story, keep
     the story's version and mark it `⚠ Build differs (Dn): <what the build does>`, using the next free `Dn` from the
     sprint's "Differences found" table in `apps/<app>/sprints/sprint-NN.md`, and add that row there
     (`| Dn | <JIRA> | <story> → <build> | PO decision | |`).
   - New facts the story didn't cover (accepted gaps) are added as normal requirement text.
   - Questions the notes leave open go to the sprint's "Questions for the developers" table ("Ask again").
   - Credentials or tokens in the notes: never copy them. Tell QA to put them in `apps/<app>/.env`.
   - Add a Change log row: `| <today> | Merged developer notes (from-dev/<date>/<file>): <one-line summary> | <QA_NAME or "QA"> |`.
4. Run `npm run req:diff -- <requirement.md>` and check the changes it lists are the ones you intended.
5. Report back: what was merged (by section), the new differences (Dn) and questions, and the next step:
   **Update tests** (`/qa-update <requirement.md>`) after QA has reviewed the merged requirement.
   Don't update test cases or tests in this command, and don't record any baseline after the merge.
