## Why

`RepositoryWorkflowsPage` still imports `@/lib/workflow-runs/service` and reads
workflow-run storage directly during server rendering, even though the hydrated
client already refreshes through `GET /api/workflows/runs`. That split
read-path keeps the browser-facing workflow list page outside the intended REST
boundary and matches the reported storage initialization failure path.

This change keeps scope narrow: route the list page bootstrap through the
existing REST API, preserve the current polling behavior after hydration, add
focused page/API regressions around the boundary and server-side bootstrap URL
handling, document the rule in `AGENTS.md`, and audit the sibling workflow
detail page without widening scope unless the same fix is mechanically
identical.

## What Changes

- Introduce the `workflow-rest-a3-p1-route-workflow-page-reads-through-rest-api`
  OpenSpec change for proposal "Route workflow page reads through REST API".
- Refactor `app/[user]/[repo]/workflows/page.tsx` so its initial workflow-run
  read goes through `GET /api/workflows/runs` instead of importing
  `@/lib/workflow-runs/service` directly.
- Add any small server-only helper needed to construct a safe absolute internal
  URL for App Router workflow page bootstrap reads, and keep
  `/api/workflows/runs` as the single repo-scoped read boundary for the list
  page.
- Preserve `WorkflowRunsListClient` polling behavior after hydration, add
  focused regressions for the page/API boundary and bootstrap origin handling,
  and update `AGENTS.md` with the workflow-page REST-only rule.
- Audit `app/[user]/[repo]/workflows/[workflowId]/page.tsx` for the same
  direct-service pattern, but keep the approved scope centered on
  `RepositoryWorkflowsPage` unless the detail-page fix is mechanically
  identical and approval-safe.

## Capabilities

### New Capabilities
- `workflow-rest-a3-p1-route-workflow-page-reads-through-rest-api`: Route the
  repository workflow list page bootstrap through the existing repo-scoped REST
  API, cover safe server-side bootstrap URL handling with regressions, and
  document the REST-only workflow-page read rule for contributors.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `fix(workflows/rest): route workflow page reads through REST API`
- Conventional title metadata: `fix(workflows/rest)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Route repository workflow list bootstrap through
  `/api/workflows/runs`, keep live polling unchanged, add focused boundary
  regressions, and document the REST-only workflow-page rule.
- Affected code areas: `app/[user]/[repo]/workflows/page.tsx`,
  `app/api/workflows/runs/*`, any new server-only workflow bootstrap URL
  helper, focused workflow page/API tests, and `AGENTS.md`
- Validation target after implementation: `pnpm fmt`, `pnpm fmt:check`,
  `pnpm lint`, targeted workflow page/API tests, and `pnpm build` when
  feasible
- Scope boundaries: no new workflow APIs, no workflow runner or storage schema
  changes, no client polling redesign, and no detail-page refactor unless the
  same boundary fix is mechanically identical
- Risks and assumptions:
  - `/api/workflows/runs` is the correct repo-scoped read boundary and should
    remain the single list-page bootstrap entry point.
  - App Router server-side bootstrap reads need a safe absolute origin; tests
    should lock down forwarded host/proto handling to avoid environment-specific
    regressions.
  - The workflow detail page shows a related smell today, but broadening scope
    beyond a mechanically identical follow-up would increase approval risk.
