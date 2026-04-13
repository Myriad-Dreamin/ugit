## ADDED Requirements

### Requirement: Finish ugit PR list/create/edit command set
The system SHALL implement the approved proposal recorded in OpenSpec change `pr-commands-a2-p1-finish-ugit-pr-list-create-edit-command-set`
and keep the work aligned with this proposal's objective: Materialize the OpenSpec-aligned change `pr-commands-a1-p1-finish-ugit-pr-list-create-edit` to add `gh pr`-inspired, non-interactive `ugit pr list`, `ugit pr create`, and `ugit pr edit` commands over the existing `pr sync` and PR-runner foundation, including shared pull-request summary/query/update contracts, repository-scoped server read/edit APIs over HTTP-over-SSH, storage queries for listing and editing PRs plus latest CI state, README and CLI help updates that clarify `create` vs `edit` vs `sync`, focused Vitest coverage, and validation with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Finish ugit PR list/create/edit command set" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(pr/commands): Finish ugit PR list/create/edit command set` and conventional-title metadata `feat(pr/commands)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(pr/commands): Finish ugit PR list/create/edit command set`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `pr-commands-a2-p1-finish-ugit-pr-list-create-edit-command-set`
