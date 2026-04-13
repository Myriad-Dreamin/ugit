## ADDED Requirements

### Requirement: Add ugit CI setup skill and manual workflow runs
The system SHALL implement the approved proposal recorded in OpenSpec change `ugit-workflow-a1-p1-add-ugit-ci-setup-skill-and-manual-workflow-runs`
and keep the work aligned with this proposal's objective: Materialize OpenSpec change `workflow-skill-a1-p1-add-ugit-ci-setup-skill` to add a repo-local Codex skill for authoring `.ugit/workflows/<workflow>` packages, extend the Clipanion CLI with `ugit workflow run` and `ugit workflow logs`, add shared server-side workflow run/list/log APIs plus durable queue/log storage that reuses ugit's CI concurrency limits, surface workflow history and status in the Next.js repository UI, and cover the new contracts with documentation and repository-standard validation.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Add ugit CI setup skill and manual workflow runs" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(workflow/ci): Add ugit CI setup skill and manual workflow runs` and conventional-title metadata `feat(workflow/ci)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(workflow/ci): Add ugit CI setup skill and manual workflow runs`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `ugit-workflow-a1-p1-add-ugit-ci-setup-skill-and-manual-workflow-runs`
