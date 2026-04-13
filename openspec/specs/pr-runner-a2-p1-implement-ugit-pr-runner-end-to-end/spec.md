# pr-runner-a2-p1-implement-ugit-pr-runner-end-to-end Specification

## Purpose
Define the runtime behavior for machine-aware `ugit` pull request publication,
remote CI orchestration, durable job state, and fast-forward merge automation.
## Requirements
### Requirement: Implement ugit PR runner end-to-end
The system SHALL implement the approved proposal recorded in OpenSpec change `pr-runner-a2-p1-implement-ugit-pr-runner-end-to-end`
and keep the work aligned with this proposal's objective: Materialize OpenSpec change `pr-runner-a1-p1-implement-ugit-pr-runner` to extend the existing `ugit create` baseline with machine-aware `ugit serve`, PR publication and synchronization over HTTP-over-SSH, server-side PR intake and durable job state, CI queueing with one active job per repository and four active jobs globally, isolated execution of `.ugit/workflows/*` packages at the queued commit, `.data/ci-results/<repo>/<branch>.json` artifacts, fast-forward auto-merge for green pull requests, focused Vitest coverage, updated README documentation, and validation with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Implement ugit PR runner end-to-end" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(pr/runner): Implement ugit PR runner end-to-end` and conventional-title metadata `feat(pr/runner)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(pr/runner): Implement ugit PR runner end-to-end`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `pr-runner-a2-p1-implement-ugit-pr-runner-end-to-end`
