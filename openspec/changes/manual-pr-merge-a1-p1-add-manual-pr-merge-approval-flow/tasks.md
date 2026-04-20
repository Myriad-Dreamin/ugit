## 1. Proposal Alignment

- [ ] 1.1 Confirm the approved scope and title metadata for manual PR merge approval
- [ ] 1.2 Keep PR detail reads and merge controls behind repo-scoped REST

## 2. Pull-Request Lifecycle And Readiness

- [ ] 2.1 Leave successful latest CI jobs in PR status `passed` instead of `merged`
- [ ] 2.2 Derive readiness from current CI, GitHub base parity, and mergeability
- [ ] 2.3 Split merge ancestry preflight from mirrored-base reset handling

## 3. GitHub Merge Service And API

- [ ] 3.1 Add server-only GitHub auth and canonical PR merge helpers
- [ ] 3.2 Add the repo-scoped merge service and merge route

## 4. UI, Tests, And Docs

- [ ] 4.1 Add the PR detail readiness card, merge button, and merge feedback
- [ ] 4.2 Cover readiness, GitHub merge, storage, route, and UI regressions
- [ ] 4.3 Document the approval flow, GitHub token setup, and validation steps
