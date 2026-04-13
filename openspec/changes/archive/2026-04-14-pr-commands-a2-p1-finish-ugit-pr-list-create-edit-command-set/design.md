## Context

This change captures proposal "Finish ugit PR list/create/edit command set" as OpenSpec change `pr-commands-a2-p1-finish-ugit-pr-list-create-edit-command-set`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Materialize the OpenSpec-aligned change `pr-commands-a1-p1-finish-ugit-pr-list-create-edit` to add `gh pr`-inspired, non-interactive `ugit pr list`, `ugit pr create`, and `ugit pr edit` commands over the existing `pr sync` and PR-runner foundation, including shared pull-request summary/query/update contracts, repository-scoped server read/edit APIs over HTTP-over-SSH, storage queries for listing and editing PRs plus latest CI state, README and CLI help updates that clarify `create` vs `edit` vs `sync`, focused Vitest coverage, and validation with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
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
- Keep the canonical request/PR title as `feat(pr/commands): Finish ugit PR list/create/edit command set`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(pr/commands)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(pr/commands): Finish ugit PR list/create/edit command set`
- Conventional title metadata: `feat(pr/commands)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: `Finish ugit PR list/create/edit command set` Suggested OpenSpec change: `pr-commands-a1-p1-finish-ugit-pr-list-create-edit` Why one proposal: - `pr list`, `pr create`, and `pr edit` all depend on the same repository-scoped pull-request read/update contract, machine inference, and HTTP-over-SSH transport. Splitting them would leave either incomplete CLI UX or private server APIs with no coherent user-facing flow. Repository context to honor: - `packages/ugit-cli` already ships Clipanion-based `ugit create`, `ugit serve`, and `ugit pr sync`. - The server already exposes `POST /api/pull-requests/sync` and persists PR plus CI job state in `lib/pr-runner/storage.ts`, but current storage only supports sync/upsert and single-record lookup by repository path plus branch. - `README.md` documents `pr sync` today; this proposal should add the missing higher-level commands and clarify when users should choose `create`, `edit`, or `sync`. Implementation objective: - Add `gh pr`-inspired but intentionally narrower `ugit pr list`, `ugit pr create`, and `ugit pr edit` commands. - Keep all client/server communication on SSH or HTTP-over-SSH; the CLI should not read remote PR state from disk directly. Expected implementation shape: - Extend `packages/ugit-cli/src/pull-request-contract.ts` with shared pull-request summary, query, and edit payload/response types so CLI and server stay aligned. - Add repository-scoped pull-request read/list/update APIs and service helpers that expose PR metadata plus latest CI/job state for the current ugit repository. - Add storage helpers that can list PRs for one repository, filter by branch/base/state, join the latest CI job per PR, and update editable fields (`title`, `body`, `baseBranch`, `draft`) without corrupting existing queue history. - Implement `ugit pr list [-m <machine>] [--state <open|merged|all>] [--base <branch>] [--head <branch>] [directory]` with a human-readable table for the current ugit repository. Expose numeric PR IDs in output, but keep the first cut repository-scoped rather than adding cross-repo discovery. - Implement `ugit pr create [-m <machine>] --base <branch> --title <title> [--body <text>] [--draft] [directory]` as the user-facing create flow: resolve the current branch, reject duplicate existing PRs for that repository/branch, then reuse the existing publish-and-sync path to push and queue CI. - Implement `ugit pr edit [-m <machine>] [--base <branch>] [--title <title>] [--body <text>] [--draft|--ready] [directory]` to edit the current-branch PR by default. Metadata-only edits should update the stored PR without pushing; base-branch changes should reuse the existing synchronization queue so validation reruns against the new base. - Keep `ugit pr sync` supported and document it as the explicit branch republish / CI rerun command after additional commits. - Update README and CLI help text so the boundaries between `pr create`, `pr edit`, and `pr sync` are explicit. - Add focused Vitest coverage for shared contract validation, repository-scoped query/update storage, new route handlers/services, command option parsing, duplicate-create behavior, metadata-only edits, base-change reruns, and list output shaping. Validation contract: - `pnpm fmt` - `pnpm fmt:check` - `pnpm lint` - `pnpm test` - `pnpm build` Scope boundaries: - No attempt to match `gh` flag-for-flag or add interactive prompts, browser flows, labels, reviewers, comments, or close/reopen behavior. - No new CI scheduling or merge semantics beyond exposing current state and rerunning when the edited base branch changes. - No direct GitHub or GitLab API integration. Assumptions and risks: - Because ugit currently has no explicit non-merged close state, `pr list --state open` should mean any non-merged PR in the repository; merged PRs remain the only terminal completed state beyond failures. - The first cut should stay repository-scoped and single-user. There is no need to mirror `gh pr list` author/reviewer filters until ugit has multi-user concepts. - Reusing the existing sync path for `pr create` is safe, but duplicate protection must happen before queueing so `create` does not silently behave like `edit` or `sync`. Approval note: - Materialize this as one OpenSpec change once approved. - Coding-review lanes stay idle until human approval arrives.
