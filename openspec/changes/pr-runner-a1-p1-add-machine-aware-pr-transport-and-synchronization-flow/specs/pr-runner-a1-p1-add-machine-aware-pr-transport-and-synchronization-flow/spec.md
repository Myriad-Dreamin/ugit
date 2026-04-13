## ADDED Requirements

### Requirement: Add machine-aware PR transport and synchronization flow
The system SHALL implement the approved proposal recorded in OpenSpec change `pr-runner-a1-p1-add-machine-aware-pr-transport-and-synchronization-flow`
and keep the work aligned with this proposal's objective: Materialize OpenSpec change `pr-runner-a1-p1-add-machine-aware-pr-transport-and-sync` to extend the existing Clipanion CLI with machine inference, `ugit serve`, and PR publish/synchronize commands, add shared SSH and HTTP transport helpers, and add server-side PR intake and persistence so repositories can register pull requests against a configured ugit machine without replanning `ugit create`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Add machine-aware PR transport and synchronization flow" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(pr/runner): implement ugit PR runner` and conventional-title metadata `feat(pr/runner)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(pr/runner): implement ugit PR runner`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `pr-runner-a1-p1-add-machine-aware-pr-transport-and-synchronization-flow`
