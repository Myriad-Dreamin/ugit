## Why

`ugit workflow run` currently only supports the durable remote queue-and-log path,
which is the right default but a poor fit for iterative debugging. A
`--local` foreground mode is needed so engineers can run one workflow package
directly against the current repository working tree, see stdout and stderr in
their terminal immediately, and stop the run by closing the terminal session
without changing the existing remote behavior.

## What Changes

- Introduce the
  `workflow-local-a1-p1-add-local-foreground-execution-to-ugit-workflow-run`
  OpenSpec change for proposal "Add `--local` foreground execution to `ugit workflow run`".
- Add `--local` to `ugit workflow run` so the named
  `.ugit/workflows/<workflow>` package runs in the foreground against the
  current repository working tree, including uncommitted local changes, and
  exits with the workflow result instead of queueing a remote run.
- Keep the existing remote queued workflow behavior unchanged when `--local` is
  absent, while rejecting incompatible remote-only flags such as `-m,--machine`
  and `-p,--port` in local mode.
- Reuse or mirror the existing workflow-package validation plus the `pnpm
  install --dir <workflow> --ignore-workspace --no-frozen-lockfile` and `pnpm
  --dir <workflow> run ugit:ci` contract for local runs, with stdout and stderr
  attached to the caller terminal and terminal shutdown signals forwarded to the
  active child process.
- Update CLI help and `README.md` to explain the local-versus-remote split,
  local dependency-cache side effects, and that `ugit workflow logs` only
  applies to remote queued runs.
- Add focused Vitest coverage plus `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`,
  `pnpm test`, and `pnpm build` validation.

## Capabilities

### New Capabilities
- `workflow-local-a1-p1-add-local-foreground-execution-to-ugit-workflow-run`:
  Add a local foreground execution mode for `ugit workflow run` while
  preserving the current remote queued workflow contract, documentation split,
  and focused test coverage.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `feat(workflow/run): support local workflow runs`
- Conventional title metadata: `feat(workflow/run)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Add one proposal that introduces `ugit workflow run --local`
  as a foreground, in-place debugging path while preserving the existing
  default remote queued workflow run.
- Affected code areas: `packages/ugit-cli/src/commands/workflow-run.ts`,
  `packages/ugit-cli/src/workflow.ts`, shared workflow-package execution
  helpers, `README.md`, and focused CLI or workflow execution tests
- Validation target after implementation: `pnpm fmt`, `pnpm fmt:check`,
  `pnpm lint`, `pnpm test`, and `pnpm build`
- Scope boundaries: no changes to remote workflow queue, storage, log, or page
  APIs; no local workflow IDs or history; no change to pull-request CI or the
  managed remote `workflow1` worktree model
- Risks and assumptions:
  - `--local` is intentionally a debugging path that runs the current local
    working tree rather than a published commit snapshot.
  - Local installs may mutate dependency state under `.ugit/workflows/<workflow>`
    or adjacent caches, so the docs need to set that expectation explicitly.
  - Terminal-close behavior is process-signal sensitive across shells and
    operating systems, so the first cut should stay with direct foreground child
    processes and explicit signal forwarding.
