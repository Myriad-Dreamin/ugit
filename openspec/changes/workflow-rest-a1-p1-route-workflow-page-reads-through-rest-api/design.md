## Context

The current workflow list page still crosses the backend boundary directly on
first render:

- `app/[user]/[repo]/workflows/page.tsx` validates the configured owner and
  resolves the repository with `getRepositoryByName`, but then imports
  `listWorkflowRuns` from `@/lib/workflow-runs/service`.
- `app/[user]/[repo]/workflows/workflow-runs-list-client.tsx` already refreshes
  through `/api/workflows/runs?repositoryName=...`, so first render and live
  refresh use different boundaries for the same data today.
- `app/api/workflows/runs/route.ts` already exposes the repo-scoped REST
  contract needed for workflow list data. The missing piece is a small
  server-side fetch path from the App Router page.
- `app/[user]/[repo]/workflows/[workflowId]/page.tsx` still imports
  `getWorkflowRunPageData` directly. That is the adjacent boundary risk, but
  its initial bootstrap includes log snapshot data that does not yet have a
  matching finite REST endpoint.
- `AGENTS.md` currently covers process and validation rules only; it does not
  yet forbid App Router workflow pages from importing backend workflow
  services.

## Goals / Non-Goals

**Goals:**

- Keep owner and repository validation in `RepositoryWorkflowsPage` while
  moving the initial workflow list read behind the existing REST API.
- Reuse `/api/workflows/runs` for both first-render bootstrap and client-side
  live polling so the list page has one browser-facing read contract.
- Add the smallest server-side fetch/origin plumbing needed for the App Router
  page to call the REST endpoint without importing workflow backend
  storage/service modules.
- Add regression tests that protect the page/API boundary and catch a direct
  workflow service import returning to the page layer.
- Add an `AGENTS.md` guardrail for workflow App Router pages and audit the
  workflow detail page for the same smell, migrating it only if a minimal REST
  bootstrap fits within this change.
- Preserve the canonical request/PR title
  `fix(workflows/rest): route workflow page reads through REST API` and
  conventional-title metadata `fix(workflows/rest)` throughout the materialized
  artifacts.

**Non-Goals:**

- Change SQLite schema or migrations, workflow queueing, scheduler behavior, or
  runner execution.
- Redesign workflow polling cadence, log streaming transport, or the workflow
  UI beyond a minimal loading/error affordance if the approved fallback is
  needed.
- Introduce a broad workflow service refactor outside page/API read boundaries.
- Force a larger workflow detail API redesign just to remove the sibling page's
  direct service import.

## Decisions

- Bootstrap `/${user}/${repo}/workflows` through the existing
  `/api/workflows/runs` endpoint from the page layer.
  Rationale: the client already polls that endpoint, so reusing it removes the
  direct service import with the smallest contract change and keeps first
  render aligned with live refresh behavior.
  Alternative considered: keep the direct `listWorkflowRuns` import or add a
  second server-only helper that mirrors the REST route. Rejected because the
  request explicitly wants the page boundary to go through REST, and duplicating
  the read contract would keep the architectural rule ambiguous.

- Keep owner and repository validation in `RepositoryWorkflowsPage` before the
  REST bootstrap happens.
  Rationale: the page already has route context and should preserve current
  not-found behavior without making an avoidable internal fetch for invalid
  routes.
  Alternative considered: delegate all validation to `/api/workflows/runs`.
  Rejected because it adds behavior drift and weakens the route-layer contract.

- Preserve `WorkflowRunsListClient` as the live-update path without changing its
  polling contract.
  Rationale: it already uses `/api/workflows/runs` correctly, so touching it
  would expand scope without helping the reported failure.
  Alternative considered: move both first render and live updates to a new
  client-only data loader. Rejected because it risks unnecessary UX changes and
  is only a fallback if server-side REST bootstrap proves awkward.

- Make regression tests assert the page/API boundary rather than only the final
  rendered markup.
  Rationale: the failure mode is architectural. Tests should prove that the
  page bootstraps through REST, preserves repo-scoped behavior, and keeps
  browser-visible payloads free of `repositoryPath`.
  Alternative considered: rely only on end-to-end rendering assertions. Rejected
  because they can pass while the page silently reintroduces a backend service
  import.

- Treat the workflow detail page as an audit-first sibling and migrate it only
  if a minimal REST bootstrap can reuse existing or narrowly extended detail
  data without redesigning log streaming.
  Rationale: the page has the same smell, but its initial load includes a log
  snapshot that is not currently exposed as a finite REST response.
  Alternative considered: require full detail-page migration in this change.
  Rejected because it can expand a focused boundary fix into a larger API
  redesign.

- Add a workflow-specific `AGENTS.md` rule for App Router pages/components.
  Rationale: the request wants a concrete preventive note, and a targeted rule
  makes boundary expectations explicit for future workflow UI work.
  Alternative considered: rely on general server-only guidance. Rejected because
  the current process rules are too generic to prevent this exact regression.

## Conventional Title

- Canonical request/PR title:
  `fix(workflows/rest): route workflow page reads through REST API`
- Conventional title metadata: `fix(workflows/rest)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [Server-side internal fetch needs a stable origin] -> Add a small
  page-friendly fetch/origin helper when possible; if that is awkward in this
  worktree, fall back to client-side initial fetch with an explicit loading
  state rather than reintroducing a direct backend import.
- [Boundary regressions can hide behind shallow mocks] -> Make page tests assert
  REST-backed bootstrap behavior and keep `/api/workflows/runs` tests focused
  on repo-scoped contracts and the absence of `repositoryPath`.
- [Detail page scope can sprawl] -> Audit the sibling page early and either
  migrate it with a minimal REST bootstrap or record a scoped follow-up note
  that explains why the larger API work was deferred.
- [First-render bootstrap adds an extra hop] -> Reuse the existing dynamic REST
  endpoint and keep the response shape unchanged so the first-render path stays
  behaviorally aligned with current live refreshes.

## Migration Plan

- No persistent data migration is expected. The change is limited to workflow
  page bootstrap plumbing, read-boundary tests, and repository guidance.
- Implement the list-page REST bootstrap first, then update regression tests,
  then add the `AGENTS.md` guardrail, and finally resolve the workflow detail
  audit as migrate-or-note.
- If the fallback client bootstrap path is needed, keep it within this same
  contract by reusing `/api/workflows/runs` and adding only the minimal loading
  state required for first render.
- Rollback is low risk: restore the direct list-page service import and remove
  the helper/test/doc changes. Workflow storage, queue state, and REST response
  shapes remain unchanged.

## Open Questions

- None.
