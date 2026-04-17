## Why

`RepositoryWorkflowsPage` still imports `listWorkflowRuns` from
`lib/workflow-runs/service`, so the first render of `/${user}/${repo}/workflows`
crosses directly into SQLite-backed workflow storage and matches the reported
`createDatabase -> ... -> RepositoryWorkflowsPage` failure path. The browser
refresh path already uses `/api/workflows/runs`, so routing the initial read
through the same REST contract removes the boundary leak with the smallest
behavioral change.

This change also needs a durable guardrail. Without an explicit App Router rule
in `AGENTS.md`, future workflow pages can reintroduce backend service imports
even if the list page is fixed now.

## What Changes

- Introduce the `workflow-rest-a1-p1-route-workflow-page-reads-through-rest-api`
  OpenSpec change for proposal "Route workflow page reads through REST API".
- Route the initial workflow list bootstrap for `/${user}/${repo}/workflows`
  through `/api/workflows/runs` instead of importing workflow backend service
  code into `RepositoryWorkflowsPage`, while preserving owner and repository
  validation in the page.
- Add the smallest server-side fetch plumbing needed for an App Router page to
  call the existing workflow REST endpoint and keep `WorkflowRunsListClient`
  polling unchanged.
- Add regression coverage for the workflow list page and
  `/api/workflows/runs` so repo-scoped data, not-found behavior, and the
  absence of browser-visible backend fields stay protected.
- Add an `AGENTS.md` rule that App Router pages/components must use workflow
  REST endpoints under `app/api` instead of importing workflow storage/service
  modules directly.
- Audit `app/[user]/[repo]/workflows/[workflowId]/page.tsx` for the same
  boundary smell and either migrate it via a minimal REST bootstrap or leave an
  explicit scoped follow-up note if that would require a broader API redesign.

## Capabilities

### New Capabilities

- `workflow-rest-a1-p1-route-workflow-page-reads-through-rest-api`: Bootstrap
  repository workflow page reads through the REST layer, preserve live polling
  behavior, add boundary regression coverage, and codify the App Router
  workflow REST guardrail.

### Modified Capabilities

- None.

## Conventional Title

- Canonical request/PR title:
  `fix(workflows/rest): route workflow page reads through REST API`
- Conventional title metadata: `fix(workflows/rest)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Move the repository workflow page read boundary onto the
  existing REST API, keep live polling intact, and codify the rule in
  `AGENTS.md`.
- Affected code areas: `app/[user]/[repo]/workflows/page.tsx`,
  `app/[user]/[repo]/workflows/[workflowId]/page.tsx` audit scope,
  `app/api/workflows/runs/route.ts`, shared workflow page/API tests, and
  `AGENTS.md`
- Validation target after implementation: `pnpm fmt`, `pnpm fmt:check`,
  `pnpm lint`, targeted workflow page/API tests, and `pnpm build` when the
  local `better-sqlite3` binding is usable
- Scope boundaries: no SQLite schema work, no runner/scheduler/queue changes,
  no broad UI redesign, and no workflow refactor beyond page/API read
  boundaries
- Risks and assumptions:
  - Preferred implementation keeps first-render data by fetching the existing
    REST endpoint from the page layer; if server-side origin resolution is
    awkward, the fallback stays within this change and moves the initial fetch
    into the client with an explicit loading state.
  - The workflow detail page has the same direct-service smell, but its initial
    log snapshot is not yet exposed as a finite REST response, so migration
    should stay optional and minimal in this change.
  - The `AGENTS.md` guardrail should land with the boundary fix so future App
    Router changes do not drift back to direct backend imports.
