## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Route workflow page reads through REST API" and keep the canonical request/PR title `fix(workflows/rest): route workflow page reads through REST API`
- [ ] 1.2 Confirm conventional-title metadata `fix(workflows/rest)` stays separate from `branchPrefix` and change paths, and record the workflow detail page audit outcome within this change

## 2. Workflow List REST Bootstrap

- [ ] 2.1 Remove the direct workflow service import from `app/[user]/[repo]/workflows/page.tsx` and load the initial workflow list through `/api/workflows/runs` while preserving owner and repository validation
- [ ] 2.2 Add the minimal server-side fetch/origin helper needed for the App Router page to call the existing workflow REST endpoint without importing backend workflow storage/service modules
- [ ] 2.3 Keep `WorkflowRunsListClient` polling and the repo-scoped workflow summary response shape unchanged for live refresh behavior

## 3. Boundary Protection

- [ ] 3.1 Add regression coverage for the workflow list page that verifies REST-backed bootstrap, not-found behavior, and the absence of browser-visible `repositoryPath`
- [ ] 3.2 Update `/api/workflows/runs` tests to cover the repo-scoped first-render bootstrap contract and keep browser-facing requests and responses free of raw repository filesystem paths
- [ ] 3.3 Add the `AGENTS.md` guardrail for workflow App Router pages/components and either migrate `app/[user]/[repo]/workflows/[workflowId]/page.tsx` via a minimal REST bootstrap or leave an explicit scoped follow-up note

## 4. Verification

- [ ] 4.1 Run `pnpm fmt` and `pnpm fmt:check`
- [ ] 4.2 Run `pnpm lint` and the targeted workflow page/API regression tests
- [ ] 4.3 Run `pnpm build` when the local `better-sqlite3` binding is usable
