## ADDED Requirements

### Requirement: Document CLI install and add `ugit serve` port forwarding
The system SHALL implement the approved proposal recorded in OpenSpec change `cli-serve-a2-p1-document-cli-install-and-add-ugit-serve-port-forwarding`
and keep the work aligned with this proposal's objective: Materialize OpenSpec change `ugit-cli-serve-a2-p1-document-cli-install-and-add-port-forward-command` to extend the existing `ugit-cli` package with a documented private CLI install workflow in `README.md`, add `ugit serve -m <machine> [-p <local-port>]` as an SSH local port-forward command that defaults `local-port` to the configured `serverPort`, cover the command and failure behavior with focused Vitest tests, and validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Document CLI install and add `ugit serve` port forwarding" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(cli/serve): Document CLI install and add `ugit serve` port forwarding` and conventional-title metadata `feat(cli/serve)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(cli/serve): Document CLI install and add `ugit serve` port forwarding`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `cli-serve-a2-p1-document-cli-install-and-add-ugit-serve-port-forwarding`
