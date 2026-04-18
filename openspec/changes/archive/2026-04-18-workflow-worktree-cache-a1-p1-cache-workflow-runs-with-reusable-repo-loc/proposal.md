## Why

Manual `ugit workflow run` jobs currently create a fresh detached checkout under
`/tmp` and remove it after each run. That keeps manual workflow execution
simple, but it also throws away the stable workflow directory path that
`pnpm install --dir <workflow>` needs for reusable dependency state.

The repository already serializes execution to one active job per repository, so
a fixed repo-local worktree slot can improve repeated manual workflow runs
without changing queueing, logging, or pull-request CI behavior. This change is
needed now to make workflow runs cache-friendly while keeping their reset and
recovery rules explicit.

## What Changes

- Introduce the
  `workflow-worktree-cache-a1-p1-cache-workflow-runs-with-reusable-repo-loc`
  OpenSpec change for proposal "Cache workflow runs with reusable repo-local
  worktrees".
- Replace manual workflow-run `/tmp` checkouts with a reusable linked worktree
  at `.data/repos/<repo>/workflow1`, while keeping pull-request CI on ephemeral
  detached worktrees.
- Extract runner worktree lifecycle handling so manual workflow runs can create,
  validate, repair, and reuse the managed worktree independently from CI
  teardown behavior.
- Define a residue policy that resets tracked files and detached-head state to
  the queued commit before each manual run without doing blanket cleanup that
  wipes reusable dependency caches during normal execution.
- Update README execution-model notes and add focused runner coverage for
  one-time creation, per-run reset behavior, stale-state recovery, and the
  absence of normal post-run worktree removal.

## Capabilities

### New Capabilities
- `workflow-worktree-cache-a1-p1-cache-workflow-runs-with-reusable-repo-loc`:
  Cache manual workflow runs through a reusable repo-local linked worktree that
  is repaired or reset per run while preserving cache usefulness and leaving
  pull-request CI behavior unchanged.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title:
  `perf(workflow/runner): reuse repo-local workflow worktrees`
- Conventional title metadata: `perf(workflow/runner)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Replace manual workflow-run `/tmp` checkouts with a reusable
  `.data/repos/<repo>/workflow1` linked worktree, reset or repair it per run,
  keep PR CI behavior unchanged, update execution-model docs, and add focused
  coverage.
- Affected code areas: `lib/pr-runner/runner.ts`, extracted runner worktree
  helpers under `lib/pr-runner/*`, `README.md`, and runner workflow tests such
  as `lib/pr-runner/runner-workflow.test.ts`
- Validation target after implementation: `pnpm fmt`, `pnpm fmt:check`,
  `pnpm lint`, `pnpm test`, and `pnpm build`
- Scope boundaries: no new CLI commands or API contract changes, no scheduler
  or concurrency changes beyond the existing one-active-execution-per-repo
  guarantee, no PR CI cache rollout, and no multi-slot workflow worktree pool
- Risks and assumptions:
  - `.data/repos/<repo>/workflow1` is safe because the current scheduler
    prevents concurrent executions for the same repository.
  - Cache preservation and residue isolation pull in opposite directions, so the
    implementation must make the normal reset policy explicit and test it.
  - Linked-worktree metadata can drift after crashes or manual deletion, so the
    helper must repair or recreate stale state instead of assuming the worktree
    is always valid.
