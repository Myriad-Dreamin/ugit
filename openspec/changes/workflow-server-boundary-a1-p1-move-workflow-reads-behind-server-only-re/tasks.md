## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Move workflow reads behind server-only repo resolution" and confirm the canonical request/PR title is `fix(workflows/storage): move workflow reads server-side`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, coding-review lanes remain idle until human approval, and conventional-title metadata `fix(workflows/storage)` stays separate from `branchPrefix` and change paths

## 2. Workflow Read Boundary

- [ ] 2.1 Refactor `app/[user]/[repo]/workflows/page.tsx` and `app/[user]/[repo]/workflows/[workflowId]/page.tsx` so repo context is resolved server-side from repo-scoped identifiers before any SQLite-backed workflow read
- [ ] 2.2 Replace path-based workflow list, detail, and log read service or validation entry points with repo-scoped server resolution in `app/api/workflows/*`, `lib/workflow-runs/service.ts`, and `lib/workflow-runs/validation.ts`, while keeping `repositoryPath` internal to storage helpers
- [ ] 2.3 Preserve current workflow summary polling, detail polling, and live log streaming behavior while ensuring browser-facing workflow reads do not expose or require `repositoryPath`

## 3. Verification

- [ ] 3.1 Add focused regression tests for workflow pages and workflow read APIs that cover repo-scoped requests, repo mismatch or not-found behavior, and the absence of browser-visible path fields in list, detail, and log flows
- [ ] 3.2 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, targeted workflow page and API tests, and `pnpm build` when the local `better-sqlite3` binding is usable
