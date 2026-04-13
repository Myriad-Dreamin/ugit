## ADDED Requirements

### Requirement: Add configured single-user repository pages
The system SHALL implement the approved proposal recorded in OpenSpec change `repo-pages-a1-p1-add-configured-single-user-repository-pages`
and keep the work aligned with this proposal's objective: Materialize one OpenSpec change that introduces a checked-in owner config for the sole username `Myriad-Dreamin`, adds a dynamic `/${user}/${repo}` App Router page backed by shared filesystem helpers for repository-root entries in `.data/repos/<repo>`, updates the current repository list UI to link into that route, covers invalid-user, missing-repo, stable-ordering, and `.git`-filtering behavior with tests, and validates with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Add configured single-user repository pages" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(user/repos): Add configured single-user repository pages` and conventional-title metadata `feat(user/repos)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(user/repos): Add configured single-user repository pages`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `repo-pages-a1-p1-add-configured-single-user-repository-pages`
