# workflow-local-a1-p1-add-local-foreground-execution-to-ugit-workflow-run Specification

## Purpose
Define local foreground workflow debugging for `ugit workflow run` while
preserving the default remote queued execution path, shared workflow-package
contract, terminal-bound signal handling, and the local-versus-remote
documentation split.
## Requirements
### Requirement: `ugit workflow run` supports explicit local foreground execution
The system SHALL support `ugit workflow run --local <workflow> [directory]` as
an explicit local execution mode that runs one named workflow package against
the current repository working tree, while preserving the existing remote
queued behavior when `--local` is absent.

#### Scenario: Local mode runs against the current repository without queueing
- **WHEN** a user runs `ugit workflow run --local lint .` inside a repository
- **THEN** the CLI SHALL resolve only the repository root from `[directory]`
- **AND** it SHALL execute workflow `lint` locally against that repository
  working tree without requiring `ugit.machine`, publishing the branch, opening
  an SSH tunnel, or creating a `workflowId`

#### Scenario: Default workflow run remains the remote queued path
- **WHEN** a user runs `ugit workflow run lint .` without `--local`
- **THEN** the CLI SHALL continue resolving the configured machine, publishing
  the current branch, and queueing the remote workflow run
- **AND** it SHALL keep printing the queued `workflowId` and remote queue
  status for that run

#### Scenario: Local mode rejects remote-only flags
- **WHEN** a user passes `--local` together with `-m,--machine` or `-p,--port`
- **THEN** the CLI SHALL fail before starting workflow execution
- **AND** the error SHALL explain that those flags are only available for the
  remote queued workflow path

### Requirement: Local workflow execution mirrors the workflow package contract
The system SHALL validate and execute local workflow runs using the same
`.ugit/workflows/<workflow>` package contract that the remote runner uses,
including `package.json` presence and the `ugit:ci` script, while keeping
execution on the current local working tree.

#### Scenario: Missing workflow package or script fails locally without remote side effects
- **WHEN** the requested workflow directory is missing, lacks `package.json`, or
  lacks a `ugit:ci` script
- **THEN** local `ugit workflow run --local` SHALL fail with actionable output
  for that workflow
- **AND** it SHALL not invoke workflow queue APIs, publish the branch, or open
  transport to the server

#### Scenario: Local mode runs install then `ugit:ci` in place
- **WHEN** the requested workflow package is valid
- **THEN** local mode SHALL run `pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
- **AND** it SHALL then run `pnpm --dir <workflow> run ugit:ci` against the
  current repository working tree, allowing local workflow dependency caches
  under `.ugit/workflows/<workflow>` to be reused or mutated

### Requirement: Local workflow execution is terminal-bound and signal-aware
The system SHALL run local workflow install and script steps as foreground child
processes attached to the caller terminal, propagate their terminal result, and
forward terminal shutdown signals to the currently active child process.

#### Scenario: Local workflow output streams directly to the caller terminal
- **WHEN** a local workflow install step or `ugit:ci` script writes to stdout or
  stderr
- **THEN** the CLI SHALL stream that output directly to the caller terminal
  while the child process runs
- **AND** the `ugit workflow run --local` command SHALL exit with the local
  workflow result instead of printing remote queue metadata

#### Scenario: Terminal shutdown signals stop the active child
- **WHEN** `ugit workflow run --local` receives `SIGINT`, `SIGTERM`, or
  `SIGHUP` while an install or workflow child process is active
- **THEN** the CLI SHALL forward the same signal to the active child process
- **AND** the CLI SHALL stop waiting only after the child exits or the signal
  terminates the parent process

### Requirement: Documentation distinguishes local debug runs from remote queued runs
The system SHALL update CLI help and `README.md` so users can clearly tell the
default remote queued workflow path from the new local foreground debugging
path.

#### Scenario: Help and README explain the execution split
- **WHEN** a user reads `ugit workflow run` help text or README workflow-run
  guidance
- **THEN** the docs SHALL describe the default command as a remote queued run
  with durable IDs and logs, and `--local` as an in-place debugging path that
  uses current local changes
- **AND** the docs SHALL state that local runs may mutate workflow dependency
  state and do not work with `ugit workflow logs`

### Requirement: Materialized artifacts preserve canonical workflow-run metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`feat(workflow/run): support local workflow runs` and conventional-title
metadata `feat(workflow/run)` without altering the approved change path
`workflow-local-a1-p1-add-local-foreground-execution-to-ugit-workflow-run`.

#### Scenario: Planner materializes the assigned local workflow-run change
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `feat(workflow/run): support local workflow runs`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
