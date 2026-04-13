## Context

`app/[user]/[repo]/page.tsx` currently validates the configured owner, loads one repository with `getRepositoryByName`, and renders only the repository-root entry list. CI already writes one latest result artifact per repository branch into `.data/ci-results/<repo>/<branch>.json`, and pull request storage already exposes repository-scoped `latestJob` state with queued, running, and completion timestamps. The missing piece is a server-only summary layer that combines those inputs into a repository page UI model without breaking the current root listing or introducing live-update behavior.

The existing CI artifact writer stores branch names directly in the artifact path. That means branches containing `/` produce nested directories under `.data/ci-results/<repo>/`, so artifact discovery needs to walk the repository result tree rather than assuming every branch result is a direct child file.

## Goals / Non-Goals

**Goals:**
- Add one server-only summary contract that turns repository-scoped CI artifacts plus pull request `latestJob` state into a normalized repository workflow summary list.
- Define deterministic precedence so a newer queued or running PR job can override an older finished artifact for the same branch.
- Extend the repository page with a workflow-status panel that keeps the existing repository-root listing and covers empty, queued, running, succeeded, failed, and mixed-result rendering.
- Keep page logic thin and move parsing, ordering, and precedence rules into helpers that are easy to cover with focused Vitest tests.
- Preserve the canonical request title `feat(workflow/ui): Show triggered workflow status in repository web UI` and conventional-title metadata `feat(workflow/ui)` across the materialized artifacts.

**Non-Goals:**
- Change how CI jobs are queued, executed, merged, or written to `.data/ci-results`.
- Add browser polling, SSE, live log streaming, workflow rerun actions, or a repository history page.
- Build a cross-repository dashboard or expose manual workflow-run history beyond what already falls out of the repository PR/CI summary contract.
- Replace the existing repository-root entry list or move this UI behind a new API endpoint when the page can read server helpers directly.

## Decisions

### 1. Introduce a dedicated server-only repository workflow summary helper

Create a focused helper under `lib/` for reading workflow status summaries instead of extending `app/[user]/[repo]/page.tsx` inline.

Why:
- The page already has enough responsibilities with route validation and rendering.
- Parsing artifacts, walking nested result directories, merging PR job state, and sorting summaries are easier to unit test outside a React component.
- A dedicated helper keeps workflow-specific logic separate from the existing repository root-entry helpers in `lib/repositories.ts`.

Alternatives considered:
- Extend `lib/repositories.ts`: rejected because workflow-summary parsing has different responsibilities, data sources, and failure modes than repository discovery and file listing.
- Fetch through `/api/pull-requests`: rejected because the repository page is server-rendered already and can reuse server helpers without introducing an internal HTTP dependency.

### 2. Use CI artifacts as the finished-state source of truth and overlay active PR jobs

Start from `.data/ci-results/<repo>/` artifacts to populate finished branch summaries, then overlay repository pull request `latestJob` state for queued and running jobs.

Why:
- Artifacts are the only source that already contains per-workflow names, pass/fail results, commit hash, merge outcome, and finished timestamps.
- Pull request `latestJob` state is the only source that can show queued or running work before a new artifact is written.
- Limiting the overlay to active jobs preserves detailed finished workflow data instead of replacing it with the thinner `latestJob` payload.

Alternatives considered:
- Rely only on pull request storage: rejected because it does not expose per-workflow results and would reduce finished summaries to coarse job status.
- Rely only on artifacts: rejected because queued and running jobs would remain invisible until completion.

### 3. Apply branch-level precedence based on recency and status

Normalize summaries by branch name. For each branch, keep the finished artifact summary as the baseline, then replace it with pull request `latestJob` data when the latest job is `queued` or `running` and its activity timestamp is newer than the artifact's `finishedAt`, or when no artifact exists yet for that branch.

Use the following timestamp order for comparisons and sorting:
- Active PR job summary: `startedAt`, then `updatedAt`, then `createdAt`
- Finished artifact summary: `finishedAt`
- Final tie-breaker: branch name ascending for deterministic output

Why:
- The request is for current/latest workflow status, not a historical run list.
- Active jobs need to override stale artifacts for the same branch, but finished artifact data should continue to power detailed workflow lists once the run completes.
- Deterministic sorting keeps the UI and tests stable across filesystems.

Alternatives considered:
- Always prefer the latest PR job regardless of status: rejected because completed jobs do not carry per-workflow details and could hide useful artifact information.
- Order alphabetically by branch: rejected because it would bury the most recent workflow activity.

### 4. Keep rendering explicit at both panel and branch-summary levels

Render a dedicated workflow-status panel on the repository page while preserving the current repository-root entries panel. The workflow panel should:
- Render an explicit empty state when no summaries exist for the repository.
- Render one summary card per branch with branch name, short commit hash, overall status badge, per-workflow rows when artifact data exists, and queued/started/finished timestamps when present.
- Render a panel-level mixed-result state when the repository has multiple branch summaries whose normalized statuses are not all the same.
- Render clear fallback copy for active-job-only summaries when detailed workflow rows are not available until a finished artifact exists.

Why:
- The request is repository-page visibility, so the new UI should live where the user already views repository details.
- Panel-level mixed status keeps the multi-branch state legible without hiding per-branch details.
- Active jobs need graceful rendering even when only overall job state is known.

Alternatives considered:
- Replace the repository-root list with workflow data: rejected because the current route already serves a useful repository listing and the planner explicitly keeps it.
- Show only per-branch badges without a panel-level mixed state: rejected because it would not satisfy the explicit mixed-result rendering requirement.

### 5. Skip malformed or foreign artifacts instead of failing the page

Treat artifact parsing as best-effort. Invalid JSON, schema mismatches, or artifacts whose `repositoryName` does not match the selected repository should be ignored, not surfaced as page errors.

Why:
- A single bad file in `.data/ci-results` should not take down repository-page rendering.
- Repository scoping needs to stay defensive because artifact files live under a filesystem tree, not behind an already-validated API.

Alternatives considered:
- Throw on the first invalid artifact: rejected because it turns partial data corruption into a full page outage.

## Conventional Title

- Canonical request/PR title: `feat(workflow/ui): Show triggered workflow status in repository web UI`
- Conventional title metadata: `feat(workflow/ui)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter the OpenSpec change path `workflow-ui-a3-p1-show-triggered-workflow-status-in-repository-web-ui`.

## Risks / Trade-offs

- [Latest-per-branch artifacts are not historical] -> Describe the UI as current/latest workflow status and avoid implying a complete run history.
- [Branch names can create nested artifact paths] -> Walk the repository result tree recursively and keep tests around slash-delimited branch names.
- [Active PR job state is thinner than finished artifacts] -> Show overall queued/running state immediately and defer detailed workflow rows until artifact data exists.
- [Repository pages read from multiple data sources] -> Keep a single normalization helper so precedence and ordering logic live in one tested place.
- [Malformed artifact files may accumulate] -> Skip invalid files defensively and cover this behavior with dedicated unit tests.

## Migration Plan

No data migration is required. Land the helper, page rendering, and tests together so the new panel ships atomically. If the panel causes regressions, rollback is limited to removing the new repository workflow summary helper and the page slice because no storage or runner contract changes are part of this proposal.

## Open Questions

- None. The implementation contract is constrained to repository-scoped, current/latest PR-triggered workflow summaries with no live-update or history features.
