## 1. Proposal Alignment

- [x] 1.1 Confirm the approved scope and title metadata for manual PR merge approval
- [x] 1.2 Keep PR detail reads and merge controls behind repo-scoped REST

## 2. Pull-Request Lifecycle And Readiness

- [x] 2.1 Leave successful latest CI jobs in PR status `passed` instead of `merged`
- [x] 2.2 Derive readiness from current CI, GitHub base parity, and mergeability
- [x] 2.3 Split merge ancestry preflight from mirrored-base reset handling

## 3. GitHub Merge Service And API

- [x] 3.1 Add server-only GitHub auth and canonical PR merge helpers
- [x] 3.2 Add the repo-scoped merge service and merge route

## 4. UI, Tests, And Docs

- [x] 4.1 Add the PR detail readiness card, merge button, and merge feedback
- [x] 4.2 Cover readiness, GitHub merge, storage, route, and UI regressions
- [x] 4.3 Document the approval flow, GitHub token setup, and validation steps
