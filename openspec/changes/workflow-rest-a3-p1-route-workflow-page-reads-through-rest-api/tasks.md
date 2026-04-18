## 1. Scope Alignment

- [ ] 1.1 Confirm the approved change keeps the canonical request/PR title `fix(workflows/rest): route workflow page reads through REST API` and conventional-title metadata `fix(workflows/rest)` without altering the assigned change path
- [ ] 1.2 Review the current workflow list page, `/api/workflows/runs` route, and sibling detail page to keep the implementation centered on `RepositoryWorkflowsPage` while recording whether the detail-page smell is mechanically identical

## 2. Workflow List REST Boundary

- [ ] 2.1 Refactor `app/[user]/[repo]/workflows/page.tsx` so its initial workflow-run read goes through `GET /api/workflows/runs` via a small server-only bootstrap URL helper instead of importing `@/lib/workflow-runs/service` directly
- [ ] 2.2 Preserve `WorkflowRunsListClient` polling behavior after hydration, and only extend the same REST-bootstrap pattern to `app/[user]/[repo]/workflows/[workflowId]/page.tsx` if the change is mechanically identical and scope-safe
- [ ] 2.3 Update `AGENTS.md` with the rule that browser-facing workflow pages must use repo-scoped REST endpoints for reads and must not import backend workflow services directly

## 3. Verification

- [ ] 3.1 Add focused regressions for `app/[user]/[repo]/workflows/page.tsx` and `app/api/workflows/runs/route.ts` that lock in the page/API boundary, not-found handling, and server-side bootstrap URL or origin behavior
- [ ] 3.2 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, targeted workflow page/API tests, and `pnpm build` when feasible for the checkout
