## ADDED Requirements

### Requirement: Manual workflow runs use a managed repo-local worktree
The system SHALL execute manual `ugit workflow run` jobs from a managed linked
worktree at `.data/repos/<repo>/workflow1` instead of creating a fresh detached
checkout under `/tmp` for every run.

#### Scenario: First manual run creates the managed worktree
- **WHEN** the first queued manual workflow run starts for a repository
- **THEN** the runner SHALL create linked worktree
  `.data/repos/<repo>/workflow1` from that repository
- **AND** the runner SHALL execute only the requested
  `.ugit/workflows/<workflow>/` package from the managed worktree

#### Scenario: Later manual runs reuse the same path
- **WHEN** a later manual workflow run starts after `workflow1` already exists
- **THEN** the runner SHALL reuse `.data/repos/<repo>/workflow1` instead of
  creating a new `/tmp` checkout
- **AND** the workflow install and run steps SHALL execute from that stable path

### Requirement: Managed workflow worktrees reset tracked state without wiping caches
The system SHALL prepare `.data/repos/<repo>/workflow1` in detached state at the
queued commit before each manual workflow run, restoring tracked files and index
state to that commit while avoiding normal cleanup that erases reusable
dependency state.

#### Scenario: Tracked drift is removed before execution
- **WHEN** the managed workflow worktree contains tracked-file edits, deletions,
  or branch attachment from a previous run
- **THEN** the runner SHALL detach the worktree to the queued commit before
  executing workflows
- **AND** the runner SHALL reset tracked files and index state to match that
  commit

#### Scenario: Dependency caches survive normal reuse
- **WHEN** the managed workflow worktree contains reusable untracked dependency
  state from an earlier run
- **THEN** the runner SHALL keep that untracked state during normal preparation
- **AND** the workflow install step SHALL execute from the same workflow
  directory path so that reusable dependency state remains available

### Requirement: Broken managed worktree state is repaired before workflow execution
The system SHALL detect when `.data/repos/<repo>/workflow1` is missing, points
at stale linked-worktree metadata, or no longer belongs to the repository, and
SHALL recover by pruning or recreating it before running the queued workflow.

#### Scenario: Stale metadata is pruned and the worktree is recreated
- **WHEN** the configured `workflow1` path exists on disk but Git reports stale
  or missing linked-worktree metadata for that path
- **THEN** the runner SHALL recover the managed worktree by pruning or removing
  the broken registration and recreating `.data/repos/<repo>/workflow1`
- **AND** the runner SHALL continue preparing the queued commit instead of
  failing on the stale state alone

#### Scenario: Unexpected ownership forces recovery
- **WHEN** the configured `workflow1` path resolves to a different Git
  repository than `.data/repos/<repo>`
- **THEN** the runner SHALL discard that broken managed worktree state and
  recreate it for the expected repository before execution

### Requirement: Pull-request CI keeps ephemeral detached worktrees
The system SHALL keep pull-request CI jobs on temporary detached git worktrees
that are removed after each run, and SHALL not route CI execution through the
managed manual workflow worktree.

#### Scenario: CI teardown remains ephemeral
- **WHEN** a pull-request CI job starts for a queued commit
- **THEN** the runner SHALL create a temporary detached worktree for that CI job
- **AND** the runner SHALL remove that temporary worktree after the CI job
  finishes

### Requirement: Managed workflow worktrees persist across normal completion
The system SHALL keep `.data/repos/<repo>/workflow1` after a normal manual
workflow run finishes, and SHALL remove or recreate it only during explicit
recovery from broken state.

#### Scenario: Normal completion keeps the managed worktree
- **WHEN** a manual workflow run completes with `succeeded` or `failed`
- **THEN** the runner SHALL leave `.data/repos/<repo>/workflow1` on disk for
  reuse by later manual runs
- **AND** the run SHALL still append durable log output and persist the terminal
  workflow status

### Requirement: Documentation and regression coverage protect the reusable worktree contract
The system SHALL document the split execution model and add regression tests for
manual workflow worktree reuse, reset behavior, stale-state recovery, and the
absence of normal post-run cleanup.

#### Scenario: README distinguishes CI and manual workflow execution models
- **WHEN** README execution-model guidance describes runner behavior
- **THEN** it SHALL describe pull-request CI as ephemeral detached-worktree
  execution
- **AND** it SHALL describe manual workflow runs as using the managed repo-local
  `workflow1` worktree for cache-friendly reuse

#### Scenario: Runner tests cover manual worktree lifecycle
- **WHEN** runner regression tests exercise manual workflow runs
- **THEN** they SHALL cover first-run creation, reuse, tracked-state reset,
  stale metadata recovery, and normal completion without worktree removal

### Requirement: Materialized artifacts preserve canonical workflow worktree cache metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`perf(workflow/runner): reuse repo-local workflow worktrees` and
conventional-title metadata `perf(workflow/runner)` without altering the
approved change path
`workflow-worktree-cache-a1-p1-cache-workflow-runs-with-reusable-repo-loc`.

#### Scenario: Planner materializes the assigned workflow worktree cache change
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `perf(workflow/runner): reuse repo-local workflow worktrees`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
