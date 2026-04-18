## Context

`app/[user]/[repo]/workflows/page.tsx` validates the configured owner and
repository, then calls `listWorkflowRuns` from `@/lib/workflow-runs/service`
while rendering the server component. `WorkflowRunsListClient` already polls
`/api/workflows/runs` after hydration, so the repository workflow list page
currently has two different read entry points for the same data.

`app/api/workflows/runs/route.ts` already exposes the repo-scoped list
contract and returns browser-safe workflow summary DTOs. Routing the initial
page bootstrap through that same endpoint is the narrowest way to enforce the
requested REST boundary without changing the live polling UX or the underlying
storage implementation.

App Router server components cannot rely on browser-relative URLs for internal
fetches. The refactor therefore needs a small server-only helper that can build
an absolute same-origin `/api/workflows/runs` URL from trusted server request
context, and focused regressions need to cover that origin handling so the page
bootstrap does not become deployment-specific.

`app/[user]/[repo]/workflows/[workflowId]/page.tsx` still imports workflow
services directly, so it should be audited during implementation. The approved
scope stays centered on `RepositoryWorkflowsPage`; the detail page only moves
in this change if the same helper and pattern apply without broader behavior or
approval changes.

The artifacts for this change must preserve the canonical request/PR title
`fix(workflows/rest): route workflow page reads through REST API` and
conventional-title metadata `fix(workflows/rest)` while execution remains
blocked pending human approval.

## Goals / Non-Goals

**Goals:**
- Route the initial workflow summary read for `/${user}/${repo}/workflows`
  through `GET /api/workflows/runs`.
- Keep owner/repository validation and not-found behavior ahead of any workflow
  storage or API read.
- Preserve the existing `WorkflowRunsListClient` polling contract and runtime
  behavior after hydration.
- Add a safe server-only helper for list-page bootstrap URL construction and
  lock it down with focused regressions.
- Update `AGENTS.md` so browser-facing workflow pages use repo-scoped REST
  endpoints for reads and do not import backend workflow services directly.

**Non-Goals:**
- Introduce new workflow APIs or change the workflow summary response shape.
- Redesign the workflow list UI or change the polling cadence.
- Refactor the workflow detail page unless the exact same helper and REST
  pattern can be reused mechanically without widening scope.
- Change workflow queueing, scheduler behavior, SQLite schema, or unrelated
  pull-request runner flows.

## Decisions

- Reuse `GET /api/workflows/runs` as the only browser-facing read boundary for
  the repository workflow list page.
  Rationale: the route already returns the required repo-scoped summary payload,
  and using it for both server bootstrap and client polling removes the current
  split entry point.
  Alternative considered: keep `RepositoryWorkflowsPage` calling
  `listWorkflowRuns` directly and only rely on REST after hydration. Rejected
  because it preserves the failing boundary and duplicates list-read behavior.

- Introduce a small server-only helper to build the absolute bootstrap URL for
  `/api/workflows/runs`.
  Rationale: App Router server rendering needs an absolute URL for internal
  fetches, and keeping that logic in one helper makes forwarded host/proto
  handling explicit and testable.
  Alternative considered: use a relative fetch URL. Rejected because server
  components do not have a browser origin.
  Alternative considered: create a new shared service helper instead of a fetch.
  Rejected because the request explicitly wants the workflow page routed through
  REST, not another direct service import.

- Preserve `WorkflowRunsListClient` as-is and only swap how
  `initialWorkflowRuns` is loaded.
  Rationale: the client already polls `/api/workflows/runs`, so changing only
  the server bootstrap keeps runtime behavior stable before and after hydration.
  Alternative considered: refactor the client and route together around a new
  loader abstraction. Rejected because it adds churn without solving the stated
  defect.

- Treat the workflow detail page as an audit checkpoint instead of mandatory
  expansion.
  Rationale: the request and planner summary explicitly name
  `RepositoryWorkflowsPage`, and the detail page should only move if the same
  helper and route pattern can be applied mechanically with no extra API or UX
  decisions.
  Alternative considered: refactor both pages together unconditionally.
  Rejected because it broadens scope and approval risk.

- Add regressions at the page and API boundary plus an `AGENTS.md` rule.
  Rationale: the defect is a contract problem, so tests and contributor
  guidance should pin both the bootstrap boundary and the server-side origin
  logic.
  Alternative considered: add only a helper unit test. Rejected because that
  would not prove the page now reads through the REST boundary.

## Conventional Title

- Canonical request/PR title: `fix(workflows/rest): route workflow page reads through REST API`
- Conventional title metadata: `fix(workflows/rest)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [Forwarded origin differences across dev/test/runtime] -> Centralize absolute
  URL construction in one server-only helper and cover representative
  host/proto cases in tests.
- [Extra same-origin HTTP hop during server render] -> Accept the small
  overhead to keep one browser-facing workflow-list read boundary and reduce
  drift between bootstrap and polling paths.
- [Scope creep from the detail-page smell] -> Audit the detail page explicitly
  and only apply the same pattern if it is mechanically identical and low risk.
- [Boundary regressions hidden behind mocks] -> Keep page tests focused on the
  REST bootstrap contract and API tests focused on repo query/origin handling
  so both sides of the boundary stay pinned.

## Migration Plan

- No persistent data migration is required. The change is limited to the
  workflow list page bootstrap path, a small server-only bootstrap URL helper,
  focused tests, and contributor guidance.
- Switch `RepositoryWorkflowsPage` to fetch `/api/workflows/runs` through the
  helper after owner/repository validation, then keep
  `WorkflowRunsListClient` polling unchanged.
- Audit `app/[user]/[repo]/workflows/[workflowId]/page.tsx` during
  implementation. If the same helper and boundary change are mechanically
  identical, include them in the same implementation; otherwise leave the page
  untouched and record the audit outcome in the implementation summary.
- Rollback is straightforward: restore the direct list-page service call and
  remove the helper/tests/docs while leaving workflow storage and APIs intact.

## Open Questions

- None.
