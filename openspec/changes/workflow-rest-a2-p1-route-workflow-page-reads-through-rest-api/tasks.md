## 1. Workflow List Page REST Bootstrap

- [ ] 1.1 Refactor `app/[user]/[repo]/workflows/page.tsx` so the initial workflow-run bootstrap goes through `GET /api/workflows/runs` instead of importing `@/lib/workflow-runs/service` directly
- [ ] 1.2 Add or reuse a narrow server-side helper for absolute internal workflow REST URLs that derives origin safely from request context, including local loopback and IPv6 development hosts
- [ ] 1.3 Keep `WorkflowRunsListClient` polling behavior unchanged while wiring the REST bootstrap response into the page boundary

## 2. Guardrails And Audit

- [ ] 2.1 Add focused regression tests for the workflow list page and related REST bootstrap path so the page no longer depends on direct workflow-service imports and local host-form origin handling stays correct
- [ ] 2.2 Update `AGENTS.md` with the workflow-page REST rule that App Router workflow pages must not import workflow storage or service modules directly for browser-facing reads
- [ ] 2.3 Audit `app/[user]/[repo]/workflows/[workflowId]/page.tsx` for the same boundary smell and either apply the same mechanical pattern or record a scoped follow-up without broadening the change

## 3. Verification

- [ ] 3.1 Run `pnpm fmt` and `pnpm fmt:check`
- [ ] 3.2 Run targeted Vitest coverage for the workflow page/API bootstrap path or `pnpm test`
- [ ] 3.3 Run `pnpm lint` and `pnpm build` when feasible, reporting any unrelated pre-existing build failure separately
