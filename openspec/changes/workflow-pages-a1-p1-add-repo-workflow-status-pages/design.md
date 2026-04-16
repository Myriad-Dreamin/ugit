## Context

`ugit` already provides three pieces this proposal can build on:

- `app/[user]/[repo]/page.tsx`, `lib/owner.ts`, and `lib/repositories.ts` establish repo-scoped browser routing for the configured owner.
- `POST /api/workflows/runs` queues manual workflow runs, and `GET /api/workflows/logs?workflowId=...` streams raw logs.
- `lib/pr-runner/storage.ts` persists workflow runs in SQLite, but today only exposes single-run lookup by `workflowId` and does not offer repo-scoped list/detail query helpers for the browser.

What is missing is a repo-safe read model for listing runs, reading one run from a repository route, and keeping those pages current without forcing users to work from CLI output or raw workflow IDs.

## Goals / Non-Goals

**Goals:**
- Add `/${user}/${repo}/workflows` and `/${user}/${repo}/workflows/[workflowId]` as repo-scoped workflow monitoring pages.
- Introduce read-side workflow-run services and GET APIs that are backed by the existing SQLite storage and enforce repository ownership on every read.
- Reuse the current repo-page validation flow, the existing log-stream endpoint, and the current App Router styling patterns.
- Add focused Vitest coverage for storage, services, API routes, page wiring, and 404 or repo-mismatch behavior.
- Preserve the canonical request/PR title `feat(repo/workflows): surface repo workflow status` and conventional-title metadata `feat(repo/workflows)` throughout the materialized artifacts.

**Non-Goals:**
- Add browser controls for starting workflows, retrying runs, cancelling runs, or changing queue priority.
- Add a global cross-repository workflow dashboard.
- Replace polling with SSE or WebSockets for list-page updates.
- Introduce a richer workflow timeline or step model beyond the current status fields and plain-text log stream.

## Decisions

- Put repo-scoped read logic in `lib/workflow-runs/service.ts`, with SQLite query helpers in `lib/pr-runner/storage.ts`.
  Rationale: this keeps validation, repo ownership checks, and response shaping in one server-side layer that routes and pages can share.
  Alternative considered: query SQLite directly from route handlers or page modules. Rejected because it would duplicate repo checks and make browser/API DTOs drift.

- Extend the workflow API surface with read endpoints while preserving existing queueing and log-stream behavior.
  Rationale: the list page needs a pollable JSON endpoint and the detail page needs a pollable status endpoint. The existing `POST /api/workflows/runs` queue endpoint and `GET /api/workflows/logs` stream endpoint already cover the write path and live log transport.
  Alternative considered: fetch workflow data directly from server components only. Rejected because the pages need live browser refresh after hydration.

- Use `GET /api/workflows/runs` for repo-scoped list reads and a dedicated detail endpoint for one run.
  Rationale: keeping list and detail reads separate matches the current `pull-requests` API shape, keeps payloads small, and makes repo-ownership checks explicit on both paths.
  Alternative considered: overload one endpoint to serve both list and detail based on query params. Rejected because it complicates validation and makes client polling contracts less clear.

- Keep route validation server-side and live updates client-side.
  Rationale: `app/[user]/[repo]/workflows/page.tsx` and `app/[user]/[repo]/workflows/[workflowId]/page.tsx` can reuse the existing configured-owner and repository lookup flow, call `notFound()` early, and hand minimal initial data into small client components for polling and log streaming.
  Alternative considered: fully client-rendered pages. Rejected because that would duplicate the current owner or repo validation flow and weaken 404 handling.

- Default to polling for workflow summaries and use the existing log stream only for active detail views.
  Rationale: polling is enough for list and status freshness, while the detail page can reuse the existing plain-text log stream when a run is still `queued` or `running`.
  Alternative considered: add SSE or WebSocket support for both list and detail updates. Rejected because it expands transport scope without being required for the approved request.

- Enforce repository ownership on every workflow detail read, even when the caller already has a `workflowId`.
  Rationale: `workflow_runs` are globally keyed by `id`, so detail reads must compare the stored `repositoryPath` against the requested repository context before returning data.
  Alternative considered: trust `workflowId` alone for detail lookups. Rejected because it risks cross-repository data leakage.

## Conventional Title

- Canonical request/PR title: `feat(repo/workflows): surface repo workflow status`
- Conventional title metadata: `feat(repo/workflows)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [Cross-repository workflow leakage] -> Require repository-scoped validation for both list and detail queries, and return not found when a workflow does not belong to the requested repository.
- [Polling load] -> Keep list/detail polling intervals modest, use `cache-control: no-store`, and scope polling to the active page only.
- [Detail-page complexity] -> Keep the live layer thin: poll structured status, and reuse the existing log stream instead of adding a second live-log transport.
- [Query drift between pages and APIs] -> Define shared DTO shaping in the service layer so App Router pages and API routes consume the same read model.

## Migration Plan

- No new persistent data model is expected; the change should read from the existing `workflow_runs` table and current log files.
- If coding uncovers missing read-oriented indexes or fields, add them as forward-only SQLite migrations inside the approved implementation change.
- Rollback is low risk: remove the new read endpoints and App Router pages while leaving existing queueing and log-stream behavior intact.

## Open Questions

- None.
