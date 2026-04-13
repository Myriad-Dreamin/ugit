## ADDED Requirements

### Requirement: Add ugit workflow run and logs
The system SHALL implement the approved proposal recorded in OpenSpec change `workflow-runs-a1-p1-add-ugit-workflow-run-and-logs`
and keep the work aligned with this proposal's objective: Materialize OpenSpec change `workflow-runs-a1-p1-add-ugit-workflow-run-and-logs` with canonical title `feat(workflow/runs): Add ugit workflow run and logs`. Add Clipanion `ugit workflow run [workflow]` and `ugit workflow logs [workflowId]` commands, workflow-run request and log-stream contracts over HTTP-over-SSH, durable workflow-run metadata plus append-only log storage keyed by workflowId, targeted single-workflow execution on the existing CI runner, shared one-per-repo and four-global queue limits with PR jobs, README/help updates, focused Vitest coverage, and validation with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Add ugit workflow run and logs" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(workflow/runs): Add ugit workflow run and logs` and conventional-title metadata `feat(workflow/runs)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(workflow/runs): Add ugit workflow run and logs`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `workflow-runs-a1-p1-add-ugit-workflow-run-and-logs`
