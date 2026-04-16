## Why

The repository UI currently stops at `/${user}/${repo}`, while workflow runs are only observable through queueing responses and the raw `/api/workflows/logs` stream. Repo-scoped workflow status pages are needed so humans can see recent runs for a repository, inspect one run without already knowing its `workflowId`, and follow live status from the browser.

This change keeps the work to one read-side slice on top of the existing SQLite-backed workflow-run storage, repo routing, and log-stream transport. It is timely because the queueing and runner primitives already exist; the missing piece is a repo-safe web surface that makes them usable day to day.

## What Changes

- Introduce the `workflow-pages-a1-p1-add-repo-workflow-status-pages` OpenSpec change for proposal "Add repo workflow status pages".
- Add `/${user}/${repo}/workflows` and `/${user}/${repo}/workflows/[workflowId]`, keeping route validation aligned with the current configured-owner repository pages and linking the existing repo page into the workflow UI.
- Add repo-scoped workflow-run list and detail read helpers plus GET API endpoints on top of the existing SQLite-backed workflow storage, with repository ownership checks on every list and detail read.
- Support browser live updates with polling for workflow summaries and the existing log stream for active workflow detail output, plus focused Vitest coverage and the full validation contract.
- Keep the proposal scoped to workflow monitoring only; it does not add controls for starting workflows from the browser, mutating workflow state, or browsing all repositories from one global dashboard.

## Capabilities

### New Capabilities
- `workflow-pages-a1-p1-add-repo-workflow-status-pages`: Add repo-scoped workflow status pages, supporting read APIs, live browser updates, discoverable navigation from repository pages, and focused validation.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `feat(repo/workflows): surface repo workflow status`
- Conventional title metadata: `feat(repo/workflows)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Implement one repo workflow dashboard slice with live repo-scoped workflow-run listing, clickable workflow-run detail/status pages, supporting read APIs, and focused tests.
- Existing code areas extended: `app/[user]/[repo]`, `app/api/workflows/*`, `lib/workflow-runs/*`, and `lib/pr-runner/storage.ts`
- Validation contract: `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`
- Scope boundaries: no browser-side workflow queueing, no workflow mutation controls, no queue-priority management, and no global workflow dashboard across repositories
- Key assumptions and risks:
  - Polling is the default live-update mechanism for workflow summaries; SSE or WebSocket transport is out of scope unless approval changes.
  - Repo ownership checks must guard both list and detail reads so arbitrary `workflowId` values cannot leak data across repositories.
  - The detail page reuses the current plain-text log stream unless richer structured status is approved as a separate change.
