## Context

This change captures proposal "Add initial Clipanion-based `ugit create` CLI" as OpenSpec change `ugit-cli-create-a1-p1-add-initial-clipanion-based-ugit-create-cli`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Materialize OpenSpec change `ugit-cli-a1-p1-add-clipanion-create-command` to create the root README, bootstrap a pnpm workspace with `packages/ugit-cli`, implement only `ugit create -m <machine> [directory]` with config loading, remote repository setup, upstream/origin handling, and local git machine recording, then validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
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
- Keep the canonical request/PR title as `feat(ugit/cli): Add initial Clipanion-based `ugit create` CLI`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(ugit/cli)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(ugit/cli): Add initial Clipanion-based `ugit create` CLI`
- Conventional title metadata: `feat(ugit/cli)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: `Add initial ugit create CLI` Suggested OpenSpec change: `ugit-cli-a1-p1-add-clipanion-create-command` Why one proposal: - README creation, workspace bootstrap, and the first CLI command share the same config, packaging, and git/ssh contract. Splitting them would create partial states and extra approval overhead. Repository context: - `ugit` is currently a single-package Next.js App Router repo with no `pnpm-workspace.yaml` and no root `README.md`. - Existing repository handling in `lib/repositories.ts` uses working-tree git repositories under `.data/repos/<repo-name>`. - Root validation commands already expected by repo policy are `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`. Implementation objective: - Add `packages/ugit-cli` with Clipanion entrypoint `packages/ugit-cli/src/main.ts` and implement only `ugit create -m <machine> [directory]`. - Create the initial root README to explain ugit, the config file shape, prerequisites for `ugit create`, and planned future commands that remain out of scope. - Leave `ugit serve`, PR publish/synchronize, CI queueing, merge automation, and `.data/ci-results` handling for later proposals. Expected implementation shape: - Add `pnpm-workspace.yaml` and adjust root scripts as needed so the existing validation commands cover the new CLI package too. - Add a config loader for `~/.local/share/ugit/config.json`, including the `local`/`localhost` special case for filesystem paths versus SSH URLs. - Implement `ugit create` to default to the current directory, require an existing local git repository, require a local `upstream` remote, derive the repo name from the directory name, create the remote repo under `<machine.path>/.data/repos/<repo-name>`, configure the remote repo `upstream`, set local `origin`, and write the selected machine into local git config for future ugit commands. - Add focused tests for config parsing, machine resolution, remote URL/path generation, local git preconditions, and child-process orchestration with mocks. Scope boundaries: - No `serve` command. - No PR publication/synchronization implementation. - No CI runner, merge queue, or HTTP endpoint work. - No behavioral changes to the existing Next.js app beyond workspace/bootstrap adjustments needed to host the CLI package. Assumptions and risks: - The request mentions both `.data/repos/<repo-name>` and an example SSH URL ending in `.git`. Because the current repo already models working-tree repositories under `.data/repos/<repo-name>`, this proposal assumes the first `create` flow targets that working-tree path directly. A bare-repo-plus-checkout model should be treated as follow-up scope if desired. - Safe first-cut behavior should fail with actionable errors for missing `upstream`, unknown machines, remote path collisions, or conflicting existing `origin` remotes instead of mutating silently. - `pnpm build` currently runs only `next build`; approved implementation should expand build orchestration so the CLI package is validated too. Approval note: - Materialize this as one OpenSpec change. - Coding-review lanes stay idle until a human approves it.
