## Context

`lib/pr-runner/runner.ts` currently sends both pull-request CI jobs and manual
workflow runs through the same `createDetachedWorktree` helper. That helper uses
`mkdtemp(path.join(os.tmpdir(), ...))`, runs `git worktree add --detach`, and
then removes the worktree in a `finally` block after the run completes.

This is safe for isolated execution, but it means every manual `ugit workflow
run` gets a brand-new path under `/tmp`. `lib/pr-runner/workflows.ts` then runs
`pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile` inside
that transient checkout, so workflow-local dependency state cannot survive
between runs even when the same repository and workflow repeat.

The repository already stores working-tree repositories under
`.data/repos/<repo>` and already enforces at most one active execution per
repository across CI jobs and manual workflow runs. That makes a single managed
worktree path, `.data/repos/<repo>/workflow1`, compatible with the current
runner concurrency model. The design therefore needs to separate ephemeral CI
worktrees from the reusable manual workflow worktree while keeping queueing,
log-streaming, and CLI or API contracts unchanged.

## Goals / Non-Goals

**Goals:**
- Reuse a stable repo-local linked worktree path for manual workflow runs so
  repeated workflow installs can reuse dependency state.
- Keep pull-request CI on isolated detached worktrees that are removed after
  each run.
- Reset manual workflow tracked state to the queued commit before each run
  without erasing cache-bearing untracked content during normal preparation.
- Detect stale or broken linked-worktree metadata and recover by pruning,
  recreating, or re-registering the managed worktree when needed.
- Update README execution-model guidance and add focused runner coverage for the
  managed worktree lifecycle.
- Preserve the canonical request/PR title
  `perf(workflow/runner): reuse repo-local workflow worktrees` and conventional
  title metadata `perf(workflow/runner)` throughout the materialized artifacts.

**Non-Goals:**
- Change workflow queueing limits, scheduler behavior, or concurrency rules.
- Introduce new CLI flags, API payload changes, or workflow log contract
  changes.
- Expand cache reuse to pull-request CI jobs.
- Build a multi-slot workflow worktree pool beyond the requested `workflow1`
  path.
- Add aggressive cleanup like `git clean -fdx` during normal preparation if it
  would wipe the dependency state this change is trying to preserve.

## Decisions

- Split runner worktree lifecycle handling into explicit ephemeral-CI and
  managed-workflow paths.
  Rationale: `executeCiJob` and `executeWorkflowRunJob` share some git-worktree
  mechanics, but their cleanup semantics now differ. A dedicated helper layer
  keeps PR CI unchanged while giving manual workflow runs validation and repair
  logic.
  Alternative considered: keep one helper with optional cleanup flags.
  Rejected because the two modes have materially different preparation,
  recovery, and teardown rules.

- Use `.data/repos/<repo>/workflow1` as the single managed manual-run worktree
  path.
  Rationale: the scheduler already guarantees one active execution per
  repository, so one fixed slot is enough and preserves the stable filesystem
  path that workflow installs can reuse.
  Alternative considered: create per-run or per-workflow reusable paths.
  Rejected because it either keeps cache misses or adds extra lifecycle
  complexity outside the approved scope.

- Prepare the managed worktree in detached state at the queued commit by
  restoring tracked files and index state without blanket untracked cleanup.
  Rationale: the main residue risk comes from tracked drift and branch
  attachment, both of which can be eliminated by checking out or resetting to
  the queued commit. Avoiding normal `git clean -fdx` preserves reusable
  dependency directories such as workflow-local `node_modules`.
  Alternative considered: always run full `git clean -fdx`.
  Rejected because it would erase most of the cache value that motivated this
  change.

- Treat broken linked-worktree metadata as a recoverable state and recreate only
  when repair is necessary.
  Rationale: crashes or manual deletion can leave `.git/worktrees/*` metadata or
  the `workflow1` path stale. The helper should validate ownership, prune stale
  metadata, and recreate the worktree only when the normal reset path cannot
  succeed.
  Alternative considered: fail the workflow run when the managed path is broken.
  Rejected because stale metadata is operational residue, not a user-facing
  workflow error, and the runner can repair it deterministically.

- Preserve the current external contracts and document the split execution
  model.
  Rationale: the user request is about runner execution caching, not CLI or API
  changes. README should explain that CI remains ephemeral while manual workflow
  runs use the managed repo-local worktree so operators understand the new cache
  behavior.
  Alternative considered: keep docs generic and rely on code comments.
  Rejected because the execution model is observable operational behavior and
  should stay documented.

## Conventional Title

- Canonical request/PR title:
  `perf(workflow/runner): reuse repo-local workflow worktrees`
- Conventional title metadata: `perf(workflow/runner)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [Cache retention can leak untracked residue] -> Reset tracked files to the
  queued commit every run, keep untracked state only in the managed workflow
  path, and cover the residue policy with focused tests.
- [Nested repo-local worktree state can drift] -> Validate that `workflow1`
  belongs to the expected repository, prune stale metadata, and recreate the
  worktree during explicit recovery paths.
- [Shared helper refactors could regress PR CI teardown] -> Keep CI on its
  existing ephemeral lifecycle and add tests that still expect detached worktree
  removal for CI jobs.
- [Repair logic may be more complex than first-run creation] -> Keep the helper
  phases explicit: ensure path, validate ownership, recover if broken, then
  detach or reset to the queued commit.

## Migration Plan

- No persistent data migration is expected. The change only alters how manual
  workflow runs prepare and reuse git worktrees under the existing
  `.data/repos/<repo>` repository layout.
- Land the helper refactor first, switch manual workflow runs to the managed
  worktree path, then update README language and runner tests in the same
  change.
- Rollback is straightforward: restore manual workflow runs to detached `/tmp`
  worktrees and remove any leftover `.data/repos/<repo>/workflow1` directories
  if they cause confusion.

## Open Questions

- None.
