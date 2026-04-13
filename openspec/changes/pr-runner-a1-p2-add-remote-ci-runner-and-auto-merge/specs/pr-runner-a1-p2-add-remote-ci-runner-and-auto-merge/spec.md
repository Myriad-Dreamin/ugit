## ADDED Requirements

### Requirement: Add remote CI runner and auto-merge
The system SHALL implement the approved proposal recorded in OpenSpec change `pr-runner-a1-p2-add-remote-ci-runner-and-auto-merge`
and keep the work aligned with this proposal's objective: Materialize OpenSpec change `pr-runner-a1-p2-add-remote-ci-runner-and-auto-merge` to consume synchronized PR records, enforce one active CI job per repository and four globally, execute `.ugit/workflows/*` validation packages on the remote repository commit, write `.data/ci-results/<repo>/<branch>.json`, and merge successful pull requests into their base branches with coverage for scheduling and failure behavior.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Add remote CI runner and auto-merge" proposal
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
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `pr-runner-a1-p2-add-remote-ci-runner-and-auto-merge`
