# repos-http-a1-p1-seed-data-repos-example-repository-and-expose-repositor Specification

## Purpose
Define the runtime behavior for seeding the `.data/repos` example repository
and exposing the discovered repositories through the HTTP app surface.
## Requirements
### Requirement: Seed `.data/repos` example repository and expose repository listing over HTTP
The system SHALL implement the approved proposal recorded in OpenSpec change `repos-http-a1-p1-seed-data-repos-example-repository-and-expose-repositor`
and keep the work aligned with this proposal's objective: Assuming the approved starter baseline is present in the claimed worktree, implement a server-only repository module rooted at `.data/repos`, idempotently ensure `example-repo` exists as a real Git repository, expose discovered repositories through `GET /api/repositories` and the main HTTP page, add ignore rules and Vitest coverage, and validate with `pnpm fmt`, `pnpm lint`, `pnpm test`, and `pnpm build`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Seed `.data/repos` example repository and expose repository listing over HTTP" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(repositories/http): Seed `.data/repos` example repository and expose` and conventional-title metadata `feat(repositories/http)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(repositories/http): Seed `.data/repos` example repository and expose`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `repos-http-a1-p1-seed-data-repos-example-repository-and-expose-repositor`
