## Context

This change captures proposal "Show triggered workflow status in repository web UI" as OpenSpec change `workflow-ui-a1-p1-show-triggered-workflow-status-in-repository-web-ui`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Materialize OpenSpec change `workflow-ui-a1-p1-show-triggered-workflow-status` by adding repository-scoped workflow-run listing/status support, exposing a read path under the workflow API surface, rendering triggered workflow statuses on the existing repository page, and covering the change with focused tests and standard repo validation.
- Preserve a reviewable OpenSpec contract before coding starts.
- Keep the proposal logical enough that any pooled worker can execute it.
- Reuse a managed worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` for cache-friendly execution.

**Non-Goals:**
- Bind this proposal to a specific branch or worker slot before approval.
- Expand scope beyond the approved proposal without human feedback.
- Merge sibling proposals into a single coding pass without replanning.

## Decisions

- Store the proposal as a dedicated OpenSpec change before coding begins.
- Let the pooled coding-review runtime allocate execution branches and worktrees after approval.
- Use planner output as the starting point for reviewer validation and follow-up tasks.
- Prefer incremental implementation that can be requeued after machine review feedback.
- Keep the canonical request/PR title as `feat(workflow/ui): Show triggered workflow status in repository web UI`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(workflow/ui)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(workflow/ui): Show triggered workflow status in repository web UI`
- Conventional title metadata: `feat(workflow/ui)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: `Show triggered workflow status in web UI` Suggested OpenSpec change: `workflow-ui-a1-p1-show-triggered-workflow-status` Why one proposal: - Repository-scoped workflow querying, HTTP read support, and page rendering are one coherent slice over the existing workflow-run persistence model. - The current UI already centers on the repository page, so adding workflow visibility there is the direct path with the least re-planning. Repository context to honor: - The browser surface is currently limited to repository list and repository root pages. - Workflow runs are already persisted with durable IDs, statuses, timestamps, branch names, commit hashes, and log paths. - Existing workflow APIs cover queueing and log streaming only; there is no list/read API or UI surface for users. - The repo uses Next.js App Router, server-side helpers in `lib/`, Vitest coverage, and the standard validation contract of `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`. Implementation objective: - Show users the list and current status of triggered workflows in the web UI for a selected repository. Expected implementation shape: - Add storage-level repository listing for workflow runs, newest first, returning the fields needed for UI rendering. - Add a workflow-run read/list service and a `GET /api/workflows/runs` contract that mirrors the existing workflow endpoint family. - Extend the repository page with a second panel for triggered workflows that renders empty, mixed-status, and finished-state cases cleanly. - Show at least: workflow ID, workflow name, status, branch, commit hash, and created/started/finished timestamps where available. - Keep the page server-rendered and refresh-based for the first cut; no live polling or log viewer is required unless implementation proves it is nearly free. - Add focused tests for storage listing order/filtering, route/service response shaping, and repository page rendering. - Update README if needed so the browser-visible workflow status surface is documented alongside the existing CLI and API workflow features. Validation contract: - `pnpm fmt` - `pnpm fmt:check` - `pnpm lint` - `pnpm test` - `pnpm build` Scope boundaries: - No browser-side workflow logs. - No retry, cancel, rerun, or trigger actions from the web UI. - No global activity dashboard spanning all repositories. - No redesign of PR pages or PR-specific UI. - No attempt to infer in-progress per-workflow PR validation details from branch CI artifacts. Assumptions and risks: - Assumption: the request targets durable manual workflow runs that are already first-class records in server storage. - If approval expects PR-triggered child workflow status with live updates, the data model needs additional first-class workflow execution records and this proposal should be expanded explicitly instead of hidden inside the page work. - Queue ordering is transient today, so the UI should prioritize durable status and timestamp fields rather than promise exact live queue position. Approval note: - Materialize this as one OpenSpec change once approved. - Coding-review lanes remain idle until human approval arrives.
