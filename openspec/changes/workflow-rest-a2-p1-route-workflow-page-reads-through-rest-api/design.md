## Context

The repository workflow list page currently resolves owner and repository
context on the server, but it still finishes the bootstrap read by importing
`listWorkflowRuns` from `@/lib/workflow-runs/service` directly in
`app/[user]/[repo]/workflows/page.tsx`. That means the initial render bypasses
`GET /api/workflows/runs` even though `WorkflowRunsListClient` already polls
that REST endpoint after hydration.

This split leaves two different entry points for the same browser-facing read:
the server component calls the workflow read service directly, while the client
refresh path goes through REST. The reported failure stack shows the list page
crossing into SQLite-backed workflow storage through the direct service import,
which is precisely the boundary this change needs to remove.

`app/api/workflows/runs/route.ts` already exposes a repo-scoped list endpoint
that returns the data shape the page uses today. The main technical concern is
not the API contract itself, but how the server-rendered page should construct
a safe absolute URL for its internal REST fetch across local development host
forms such as `localhost`, `127.0.0.1`, or `[::1]`, and across forwarded host
or protocol headers when the route runs behind another server. The sibling
workflow detail page still imports `getWorkflowRunPageData` directly, so this
change should audit that page but only fold it in when the same helper or
pattern applies without expanding the API surface.

## Goals / Non-Goals

**Goals:**
- Route the initial `/${user}/${repo}/workflows` bootstrap read through
  `GET /api/workflows/runs` instead of a direct workflow read service import.
- Keep `WorkflowRunsListClient` polling unchanged so live refresh continues
  through the existing REST endpoint.
- Add or reuse a narrow server-side helper that derives a safe absolute origin
  from request context for internal REST fetches without hardcoding
  `localhost`.
- Add regression tests that prove the list page no longer depends on direct
  workflow read service imports and that REST bootstrap origin handling works
  for local development host forms, including loopback or IPv6.
- Update `AGENTS.md` with a workflow-page rule that App Router workflow pages
  must bootstrap browser-facing reads through REST endpoints instead of
  importing workflow storage or service modules directly.
- Audit `app/[user]/[repo]/workflows/[workflowId]/page.tsx` for the same smell
  and either apply the same narrow pattern or leave a scoped follow-up.
- Preserve the canonical request/PR title
  `fix(workflows/rest): route workflow page reads through REST API` and
  conventional title metadata `fix(workflows/rest)` throughout the materialized
  artifacts.

**Non-Goals:**
- Redesign the workflow storage layer, queueing, scheduler behavior, or
  browser-facing workflow DTOs outside the page bootstrap boundary.
- Replace the existing polling behavior with a new client transport or data
  fetching framework.
- Broaden the change into a full migration of every workflow page or API unless
  the detail page fix is mechanically identical to the list-page pattern.
- Introduce new workflow API contracts if the existing list endpoint already
  satisfies the page bootstrap need.

## Decisions

- Use `GET /api/workflows/runs` as the single source of truth for the workflow
  list page's initial browser-facing read.
  Rationale: the endpoint already backs the live polling path, so reusing it
  removes the page/API split and keeps the page contract aligned with the
  browser refresh path.
  Alternative considered: keep the page on a direct server-side service call
  and only document the boundary. Rejected because it preserves the exact smell
  that triggered the failure.

- Add or reuse a narrow server-side internal fetch helper that derives an
  absolute origin from request context or headers, including loopback and IPv6
  local development hosts.
  Rationale: server component fetches need an absolute URL, and the request
  context already has enough information to build one safely without assuming a
  fixed host.
  Alternative considered: hardcode `http://localhost` or reconstruct the API
  response by calling the service layer directly. Rejected because hardcoding
  breaks non-`localhost` dev hosts and direct service calls bypass the required
  REST boundary.

- Keep `WorkflowRunsListClient` polling unchanged.
  Rationale: the live refresh path is already correct from a boundary
  perspective, so the change should avoid unnecessary client churn.
  Alternative considered: refactor both bootstrap and polling into a new shared
  client or server abstraction. Rejected because it broadens scope without
  helping the reported defect.

- Treat the workflow detail page as audit-first scope.
  Rationale: `app/[user]/[repo]/workflows/[workflowId]/page.tsx` shows the same
  direct-service smell, but it may need a different REST contract because it
  bootstraps both detail data and initial log state. Folding it in is acceptable
  only when the same helper and endpoint pattern applies mechanically.
  Alternative considered: require the detail page migration inside this change.
  Rejected because it can force new API design and expand the request beyond
  the list-page boundary fix.

- Add an explicit workflow-page rule to `AGENTS.md`.
  Rationale: the repository needs a durable guardrail that App Router workflow
  pages must not import workflow storage or service modules directly when
  bootstrapping browser-facing reads.
  Alternative considered: rely only on tests. Rejected because tests catch
  regressions late, while the doc rule sets the expected boundary before code
  is written.

## Conventional Title

- Canonical request/PR title: `fix(workflows/rest): route workflow page reads through REST API`
- Conventional title metadata: `fix(workflows/rest)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter the OpenSpec change path.

## Risks / Trade-offs

- [Absolute origin derivation varies across environments] -> Centralize the
  helper and cover `localhost`, loopback, IPv6, and forwarded-header forms with
  focused tests.
- [Initial render adds an internal HTTP hop] -> Accept the small bootstrap cost
  so browser-facing workflow reads consistently flow through one REST boundary;
  the page already relies on the same endpoint for polling after hydration.
- [Detail-page audit uncovers a broader gap] -> Limit this change to list-page
  REST bootstrap unless the detail page can reuse the same helper or endpoint
  pattern without new API design.
- [Tests can couple to implementation details] -> Assert the public boundary by
  checking the page/API interaction and the absence of direct workflow-service
  dependencies rather than snapshotting incidental fetch options.

## Migration Plan

- No persistent data migration is required. This is a page/API boundary change
  on top of the existing workflow-runs REST contract.
- Implement the server-side REST origin helper first so the page can bootstrap
  through an absolute `/api/workflows/runs` URL.
- Switch the repository workflow list page to use that helper and the existing
  REST endpoint, then confirm `WorkflowRunsListClient` keeps polling the same
  endpoint unchanged.
- Add boundary regressions for the page bootstrap and host handling, update
  `AGENTS.md`, and record a scoped follow-up if the detail-page audit requires
  more than the same mechanical pattern.
- Rollback is low risk: restore the previous direct service bootstrap call and
  keep the existing REST endpoint unchanged.

## Open Questions

- Can the detail page's initial detail-plus-log bootstrap be routed through an
  existing REST endpoint with the same narrow helper, or does that require a
  separate follow-up change? The audit should answer this during
  implementation, but it is not a blocker for the list-page fix.
