## ADDED Requirements

### Requirement: Show triggered workflow status in repository web UI
The system SHALL implement the approved proposal recorded in OpenSpec change `workflow-ui-a1-p1-show-triggered-workflow-status-in-repository-web-ui`
and keep the work aligned with this proposal's objective: Materialize OpenSpec change `workflow-ui-a1-p1-show-triggered-workflow-status` by adding repository-scoped workflow-run listing/status support, exposing a read path under the workflow API surface, rendering triggered workflow statuses on the existing repository page, and covering the change with focused tests and standard repo validation.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Show triggered workflow status in repository web UI" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(workflow/ui): Show triggered workflow status in repository web UI` and conventional-title metadata `feat(workflow/ui)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(workflow/ui): Show triggered workflow status in repository web UI`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `workflow-ui-a1-p1-show-triggered-workflow-status-in-repository-web-ui`
