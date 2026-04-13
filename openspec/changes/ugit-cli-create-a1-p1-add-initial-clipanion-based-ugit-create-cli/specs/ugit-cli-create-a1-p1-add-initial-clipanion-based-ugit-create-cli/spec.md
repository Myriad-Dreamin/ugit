## ADDED Requirements

### Requirement: Add initial Clipanion-based `ugit create` CLI
The system SHALL implement the approved proposal recorded in OpenSpec change `ugit-cli-create-a1-p1-add-initial-clipanion-based-ugit-create-cli`
and keep the work aligned with this proposal's objective: Materialize OpenSpec change `ugit-cli-a1-p1-add-clipanion-create-command` to create the root README, bootstrap a pnpm workspace with `packages/ugit-cli`, implement only `ugit create -m <machine> [directory]` with config loading, remote repository setup, upstream/origin handling, and local git machine recording, then validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Add initial Clipanion-based `ugit create` CLI" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(ugit/cli): Add initial Clipanion-based `ugit create` CLI` and conventional-title metadata `feat(ugit/cli)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(ugit/cli): Add initial Clipanion-based `ugit create` CLI`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `ugit-cli-create-a1-p1-add-initial-clipanion-based-ugit-create-cli`
