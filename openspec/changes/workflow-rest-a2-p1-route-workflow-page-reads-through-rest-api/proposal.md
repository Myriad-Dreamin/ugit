## Why

`app/[user]/[repo]/workflows/page.tsx` currently imports
`@/lib/workflow-runs/service` and bootstraps initial workflow summaries by
calling `listWorkflowRuns` directly inside the server component. That bypasses
the existing REST boundary even though the page's live polling path already
refreshes through `GET /api/workflows/runs`, and it matches the reported
storage-stack failure path from `RepositoryWorkflowsPage`.

This change routes the workflow list page's initial read through the same REST
surface the browser already uses, keeps the live polling path intact, and adds
an explicit workflow-page guardrail in `AGENTS.md` so App Router pages do not
reintroduce direct workflow storage or service imports.

## What Changes

- Introduce the
  `workflow-rest-a2-p1-route-workflow-page-reads-through-rest-api` OpenSpec
  change for proposal "Route workflow page reads through REST API".
- Refactor `app/[user]/[repo]/workflows/page.tsx` so initial workflow-run
  bootstrap data comes from `GET /api/workflows/runs` instead of a direct
  `@/lib/workflow-runs/service` import.
- Reuse the existing browser-facing REST contract and preserve
  `WorkflowRunsListClient` polling so post-render refreshes keep using the same
  endpoint.
- Add or reuse a narrow server-side helper for absolute internal REST URL
  construction so page bootstrap works with local development host forms such
  as `localhost`, loopback addresses, or IPv6 without hardcoding `localhost`.
- Add regression coverage for the page or API boundary and REST bootstrap URL
  handling, update `AGENTS.md` with the workflow-page REST rule, and audit the
  sibling workflow detail page for the same smell without broadening scope
  unless the same helper or pattern applies mechanically.

## Capabilities

### New Capabilities
- `workflow-rest-a2-p1-route-workflow-page-reads-through-rest-api`:
  Bootstrap the repository workflow list page through the existing workflow
  runs REST endpoint, keep live polling on that endpoint, and document that
  browser-facing workflow pages must not import workflow storage or service
  modules directly.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `fix(workflows/rest): route workflow page reads through REST API`
- Conventional title metadata: `fix(workflows/rest)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter the OpenSpec change path.

## Impact

- Affected repository: `ugit`
- Planner summary: Route repository workflow page bootstrap reads through the
  existing REST API, preserve live polling, add boundary regressions, and
  document the workflow-page REST rule in `AGENTS.md`.
- Affected code areas: `app/[user]/[repo]/workflows/page.tsx`,
  `app/[user]/[repo]/workflows/page.test.ts`, `app/api/workflows/runs/*`,
  any narrow helper needed for server-side REST origin construction, and
  `AGENTS.md`
- Validation target after implementation: `pnpm fmt`, `pnpm fmt:check`,
  targeted Vitest coverage for the workflow page/API bootstrap path or
  `pnpm test`, `pnpm lint`, and `pnpm build` when feasible
- Scope boundaries: no workflow schema or storage redesign, no queueing or
  scheduler work, no UI redesign, and no broad rewrite of all workflow routes
  into a new architecture
- Risks and assumptions:
  - `GET /api/workflows/runs` already returns the shape the list page needs, so
    the main implementation risk is safe absolute URL construction for
    server-side REST bootstrap.
  - The sibling workflow detail page still imports workflow service code today;
    this change only folds that page in if the same narrow helper or pattern
    applies without adding new API design.
  - The existing `WorkflowRunsListClient` polling path is already on the right
    REST surface and should remain unchanged.
