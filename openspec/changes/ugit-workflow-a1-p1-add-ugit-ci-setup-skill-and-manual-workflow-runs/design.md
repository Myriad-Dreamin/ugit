## Context

This change captures proposal "Add ugit CI setup skill and manual workflow runs" as OpenSpec change `ugit-workflow-a1-p1-add-ugit-ci-setup-skill-and-manual-workflow-runs`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Materialize OpenSpec change `workflow-skill-a1-p1-add-ugit-ci-setup-skill` to add a repo-local Codex skill for authoring `.ugit/workflows/<workflow>` packages, extend the Clipanion CLI with `ugit workflow run` and `ugit workflow logs`, add shared server-side workflow run/list/log APIs plus durable queue/log storage that reuses ugit's CI concurrency limits, surface workflow history and status in the Next.js repository UI, and cover the new contracts with documentation and repository-standard validation.
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
- Keep the canonical request/PR title as `feat(workflow/ci): Add ugit CI setup skill and manual workflow runs`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(workflow/ci)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(workflow/ci): Add ugit CI setup skill and manual workflow runs`
- Conventional title metadata: `feat(workflow/ci)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: `Add ugit CI setup skill and manual workflow runs` Suggested OpenSpec change: `workflow-skill-a1-p1-add-ugit-ci-setup-skill` Why one proposal: - The Codex skill is not independently useful without a stable `ugit workflow run` / `ugit workflow logs` contract and a server-side workflow-run model to execute against. - The CLI, remote queueing, log streaming, and web UI all need the same workflow-run identity and status model. Splitting them would create partial behavior that pooled coding lanes could not validate end-to-end. Repository context: - `packages/ugit-cli` already has Clipanion wiring, machine config loading, machine inference, `ugit create`, `ugit serve`, and PR commands over HTTP-over-SSH. - The server already has SQLite-backed CI queueing, detached worktree execution, workflow package discovery under `.ugit/workflows/*`, and artifact writing for PR-triggered jobs. - The web app currently lists repositories and repository root entries only; it does not expose workflow history or log views. - `.codex/skills` currently only contains OpenSpec skills, so the requested CI setup skill will be a new repo-local skill surface. Implementation objective: - Add a repo-local Codex skill that can inspect a repository, create or update `.ugit/workflows/<workflow>/` as an npm package with a `ugit:ci` script, explain prerequisites, and optionally trigger and inspect that workflow through ugit CLI commands. - Extend the CLI with `ugit workflow run <workflow>` and `ugit workflow logs <workflowId>` using the existing machine inference and HTTP-over-SSH transport patterns. - Add server-side manual workflow-run APIs, durable workflow-run storage, shared queue coordination, and streaming log delivery. - Expose workflow run history and status in the existing Next.js web UI for each repository. - Validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`. Expected implementation shape: - Reuse current repository and machine resolution. `ugit workflow run` should likely push the current branch HEAD to `origin` before queueing the run so the remote server has the commit to execute. - Treat manual workflow runs as the same CI resource class as PR-triggered jobs, sharing the existing one-active-per-repository and four-active-globally limits instead of creating a second independent runner. - Introduce durable workflow-run records keyed by workflow ID, storing repository, branch, commit, workflow name, status, timestamps, and any result/log paths. Persist live logs in a tailed file or equivalent append-only store that both CLI and web UI can read. - Add Next.js API routes for starting a workflow, listing workflow runs, fetching run status, and streaming or tailing logs. The CLI should consume the same HTTP-over-SSH endpoints that the browser uses after `ugit serve`. - Extend the repository page with a workflow history panel and add a dedicated run detail view if needed for clean status and log presentation. - Create `.codex/skills/ugit-ci-setup/` with `SKILL.md` plus minimal references/templates for common workflow packages. The skill should inspect the repository before generating files and fail clearly when the repository is not yet connected to ugit. - Add focused tests around CLI parsing/output, push-before-run behavior, queue sharing, log streaming, API validation, and UI rendering of workflow histories/statuses. Update `README.md` with manual workflow and skill usage. Scope boundaries: - No GitHub Actions or third-party CI integration. - No browser-based workflow editor; authoring remains local through Codex skill plus filesystem changes. - No expansion beyond the current conservative CI capacity rules unless a later proposal changes them. - No redesign of PR auto-merge beyond queue integration required so manual runs and PR runs share capacity safely. Assumptions and risks: - This proposal assumes `ugit workflow run` should operate on the current branch HEAD after pushing it to ugit `origin`. If arbitrary commit selection or no-push behavior is required, the contract should be revised before approval. - This proposal assumes manual workflow runs share queue capacity with PR-driven CI. If they are meant to be isolated, storage and scheduling need replanning. - Streaming logs require a long-lived Node process and persisted log output that can be tailed by both CLI and web UI; a serverless deployment model would change the implementation shape. - The request only requires list/status visibility in the web UI. Detailed in-browser live log streaming can remain follow-up scope if tighter initial scope is preferred, but the underlying log API still needs to exist for `ugit workflow logs`. Approval note: - Materialize this as one OpenSpec change after human approval. - Coding and review lanes should remain idle until approval arrives.
