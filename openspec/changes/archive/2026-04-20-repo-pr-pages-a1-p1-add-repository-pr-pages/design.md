## Context

`ugit` already has most of the primitives this proposal needs:

- `app/[user]/[repo]/page.tsx`, `lib/owner.ts`, and `lib/repositories.ts` establish repo-scoped browser routing and repository validation.
- `app/[user]/[repo]/workflows/page.tsx` plus `lib/workflow-runs/rest-paths.ts` and `lib/workflow-runs/rest-bootstrap.ts` show the REST-only bootstrap pattern that browser-facing pages must follow.
- `app/api/pull-requests/route.ts`, `lib/pr-runner/service.ts`, and `lib/pr-runner/validation.ts` already support path-based pull-request list and edit behavior for CLI callers.
- `lib/pr-runner/storage.ts` persists pull requests and CI jobs, while `lib/pr-runner/results.ts` writes per-job workflow execution summaries into `.data/ci-results/<repo>/<branch>.json`.

What is missing is a repo-safe browser read slice for listing PRs by repository name, reading one PR by repository plus id, reconstructing or persisting activity history, and surfacing a delegated GitHub destination without requiring raw repository paths in page props or client fetches.

## Goals / Non-Goals

**Goals:**
- Add `/${user}/${repo}/pull-requests` and `/${user}/${repo}/pull-requests/[pullRequestId]` as repo-scoped PR monitoring pages.
- Introduce browser-safe pull-request list and detail DTOs that omit raw `repositoryPath` values while including PR metadata, latest and historical CI jobs, workflow execution summaries, activity entries, and GitHub delegation metadata.
- Add repo-scoped GET pull-request APIs and REST bootstrap helpers that resolve repositories by name on the server and preserve cross-repository isolation.
- Persist or reliably derive PR activity for create, sync, edit, CI start, CI finish, and merge transitions.
- Reuse current repository-page and workflow-page UI patterns, add discoverable navigation, and preserve the canonical request title `feat(pr-pages): surface repository PR pages` plus conventional-title metadata `feat(pr-pages)`.

**Non-Goals:**
- Add browser controls for creating, editing, syncing, merging, retrying, or cancelling pull requests.
- Build a global pull-request dashboard across repositories.
- Add GitHub comments, reviews, status-check synchronization, or authenticated GitHub API lookups.
- Change CI scheduling, merge semantics, or workflow execution behavior beyond surfacing existing PR-triggered job results.

## Decisions

- Add dedicated browser read DTOs alongside the existing CLI pull-request contract.
  Rationale: browser pages need repo-scoped, read-only models that omit `repositoryPath`, include detail-only fields such as activity and GitHub delegation, and can evolve without breaking CLI callers.
  Alternative considered: reuse the existing path-based CLI DTOs everywhere. Rejected because that would leak raw filesystem paths to browser-facing reads and make detail-only fields awkward.

- Resolve repo-scoped PR reads by `repositoryName` and `pullRequestId`, while preserving repository-path list and edit behavior for the CLI.
  Rationale: repository names are already the browser route identity, and matching reads on stored `repository_name` avoids path exposure and reduces path-drift coupling.
  Alternative considered: keep browser reads path-based. Rejected because it violates the repo-scoped REST boundary and weakens safe same-origin page contracts.

- Add a forward-only `pull_request_events` SQLite table for activity history, with graceful fallback for legacy PRs that predate the migration.
  Rationale: the current `pull_requests` and `ci_jobs` tables are summary-oriented and cannot reliably reconstruct edits, syncs, and job lifecycle events over time.
  Alternative considered: derive the entire activity feed from current pull-request and CI job rows only. Rejected because important transitions would be lost or ambiguous.

- Parse workflow execution summaries from CI result artifacts at read time instead of duplicating them into a new workflow-history table.
  Rationale: `.data/ci-results/<repo>/<branch>.json` is already the durable summary artifact for completed PR CI jobs, so the detail read can enrich CI history from the existing source of truth.
  Alternative considered: persist parsed workflow execution rows in SQLite. Rejected because it duplicates artifact data and introduces new write-path complexity without clear benefit.

- Add repo-scoped GET list/detail routes plus `lib/pull-requests/rest-paths.ts` and `lib/pull-requests/rest-bootstrap.ts`, and require the new App Router pages to bootstrap through those REST endpoints.
  Rationale: this mirrors the existing workflow-page boundary, keeps page modules thin, and lets hydrated client components poll the same same-origin endpoints used during server render.
  Alternative considered: call backend PR services directly from App Router pages. Rejected because browser-facing page reads must stay behind repo-scoped REST boundaries.

- Derive GitHub delegation metadata on the server from repository Git remotes, preferring a copied `upstream` GitHub remote and falling back to compare/create or unavailable states.
  Rationale: the current data model does not store a canonical GitHub PR number or URL, but base/head branches plus a GitHub remote are enough for a useful best-effort destination.
  Alternative considered: require the GitHub API to resolve every PR URL. Rejected because authenticated external integration is explicitly out of scope for the first cut.

- Poll only while active PR jobs exist.
  Rationale: the request calls for live status without unnecessary load, so list and detail clients should refresh only when the latest or relevant CI job remains `queued` or `running`.
  Alternative considered: constant polling for every repo PR page. Rejected because it adds avoidable load after the data is already terminal.

## Risks / Trade-offs

- [Legacy timeline gaps] -> Record forward-only events for new transitions and fall back to derived snapshot entries when older PRs lack full history.
- [Dual GET contract complexity] -> Keep repository-name browser reads and repository-path CLI reads in shared validators or service boundaries with explicit tests for both modes.
- [Malformed or missing result artifacts] -> Treat workflow summaries as best-effort enrichment, surface an unavailable state for the affected CI job, and keep the PR detail response successful.
- [GitHub link ambiguity] -> Return compare/create or unavailable metadata instead of failing the repo PR page when a canonical GitHub PR URL cannot be derived.
- [Cross-repository leakage] -> Enforce repository-name ownership checks on every detail read and add storage, service, route, and page tests for mismatch handling.

## Migration Plan

- Add a forward-only SQLite migration for `pull_request_events` and start recording events at existing PR state-transition points.
- Keep the existing `GET /api/pull-requests?repositoryPath=...` and `PATCH /api/pull-requests` behavior for CLI callers while adding repo-name list/detail reads for the browser.
- Land the new App Router pages and navigation as additive routes under `app/[user]/[repo]/pull-requests/`.
- Rollback remains low risk: remove the new routes and browser read helpers while leaving the event table unused if necessary.

## Open Questions

- None. If the owner later wants canonical GitHub PR numbers, cross-repository dashboards, or manual workflow runs mixed into PR history, those should be follow-up changes.
