## 1. Workflow Read Model

- [x] 1.1 Add repo-scoped workflow-run list and detail query helpers in `lib/pr-runner/storage.ts`, and expose shared read DTOs or mappers from `lib/workflow-runs/service.ts`
- [x] 1.2 Add validation and GET workflow API routes for repo-scoped list and detail reads while preserving `POST /api/workflows/runs` and `GET /api/workflows/logs`

## 2. Repository Workflow Pages

- [x] 2.1 Add `/${user}/${repo}/workflows` with current owner or repository validation, discoverable navigation from the existing repo page, and client-side polling for live summaries
- [x] 2.2 Add `/${user}/${repo}/workflows/[workflowId]` with repo-scoped workflow lookup, live status refresh, and log output that reuses the existing workflow log stream when the run is active

## 3. Verification

- [x] 3.1 Add focused Vitest coverage for storage queries, workflow services, workflow API routes, repo and workflow 404 handling, and page-level wiring
- [x] 3.2 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`
