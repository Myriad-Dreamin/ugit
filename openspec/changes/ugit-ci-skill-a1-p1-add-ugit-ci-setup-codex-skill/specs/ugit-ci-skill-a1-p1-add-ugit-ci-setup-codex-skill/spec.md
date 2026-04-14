## ADDED Requirements

### Requirement: Add ugit CI setup Codex skill
The system SHALL implement the approved proposal recorded in OpenSpec change
`ugit-ci-skill-a1-p1-add-ugit-ci-setup-codex-skill` and keep the work aligned
with this proposal's objective: add one repo-local `ugit-ci-setup` skill under
`.codex/skills` with concise instructions, targeted references, optional
minimal scaffolding assets or helper scripts, and discoverability docs so
users can ask Codex to inspect a repository, confirm ugit prerequisites,
scaffold `.ugit/workflows/<workflow>/` packages with a valid `ugit:ci` script,
explain the resulting repository changes, and queue remote CI through the
existing `ugit pr sync` flow without changing the current server-side workflow
contract.

#### Scenario: Approved proposal enters execution

- **WHEN** a human approves the "Add ugit CI setup Codex skill" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and
  machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed
implementation branch and reusable worktree until human feedback explicitly
requests request-group replanning.

#### Scenario: Dedicated execution workspace

- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a
  reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title
`feat(ci/skill): introduce ugit ci setup skill` and conventional-title
metadata `feat(ci/skill)` through the materialized OpenSpec artifacts without
changing the proposal title "Add ugit CI setup Codex skill" or the change path
`ugit-ci-skill-a1-p1-add-ugit-ci-setup-codex-skill`.

#### Scenario: Materialized artifacts mirror the approved scope

- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the
  canonical request/PR title
  `feat(ci/skill): introduce ugit ci setup skill`
- **AND** the proposal title SHALL remain `Add ugit CI setup Codex skill`
- **AND** the OpenSpec change path SHALL remain
  `ugit-ci-skill-a1-p1-add-ugit-ci-setup-codex-skill`
