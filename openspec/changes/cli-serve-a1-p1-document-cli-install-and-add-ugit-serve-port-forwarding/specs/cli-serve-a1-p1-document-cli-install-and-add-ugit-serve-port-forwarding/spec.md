## ADDED Requirements

### Requirement: Document CLI install and add `ugit serve` port forwarding
The system SHALL implement the approved proposal recorded in OpenSpec change `cli-serve-a1-p1-document-cli-install-and-add-ugit-serve-port-forwarding`
and keep the work aligned with this proposal's objective: Materialize one OpenSpec change that updates `README.md` with a supported install workflow for the private `ugit` CLI, adds Clipanion command `ugit serve -m <machine> [-p <local-port>]` backed by existing machine config and SSH port forwarding with `local-port` defaulting to `serverPort`, covers tunnel and failure behavior with focused tests, and validates with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

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
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `cli-serve-a1-p1-document-cli-install-and-add-ugit-serve-port-forwarding`
