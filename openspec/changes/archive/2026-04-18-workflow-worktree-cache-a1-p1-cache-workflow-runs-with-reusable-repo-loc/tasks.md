## 1. Proposal Alignment

- [x] 1.1 Confirm the approved OpenSpec artifacts for "Cache workflow runs with
      reusable repo-local worktrees" keep the canonical request/PR title
      `perf(workflow/runner): reuse repo-local workflow worktrees`
- [x] 1.2 Keep conventional-title metadata `perf(workflow/runner)` separate from
      `branchPrefix` and the approved change path
      `workflow-worktree-cache-a1-p1-cache-workflow-runs-with-reusable-repo-loc`

## 2. Runner Worktree Lifecycle

- [x] 2.1 Extract worktree lifecycle helpers from `lib/pr-runner/runner.ts` so
      pull-request CI keeps ephemeral detached worktrees and manual workflow
      runs get a dedicated managed lifecycle
- [x] 2.2 Implement managed manual-run preparation for
      `.data/repos/<repo>/workflow1`, including first-use creation, repository
      ownership validation, stale metadata repair or recreation, and detached
      reset to the queued commit
- [x] 2.3 Preserve cache usefulness by resetting tracked state per run without
      normal blanket cleanup, leave the managed workflow worktree in place after
      success or failure, and keep workflow queueing, logging, and merge
      behavior unchanged

## 3. Docs And Verification

- [x] 3.1 Update README execution-model notes and add focused runner tests for
      manual worktree creation, reuse, tracked-state reset, stale-state
      recovery, and the absence of normal post-run removal
- [x] 3.2 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and
      `pnpm build`
