## What and why
<!-- Story / module (Jira key), requirement change, or framework change. -->

## Checklist
- [ ] `npx tsc --noEmit` and `npm run lint` pass
- [ ] `npm run coverage:tc` and `npm run trace:check` show no errors for the app
- [ ] Tests run green locally, or every failure is a `knownBug('<JIRA>')` / `pendingDecision('Dn')`
- [ ] No secrets: credentials only in `apps/<app>/.env` (never committed)
- [ ] Changed screenshots looked at before approving (`npm run visual:update`)
- [ ] Framework change (`src/`): generic for every app, `CLAUDE.md` updated if a rule changed
