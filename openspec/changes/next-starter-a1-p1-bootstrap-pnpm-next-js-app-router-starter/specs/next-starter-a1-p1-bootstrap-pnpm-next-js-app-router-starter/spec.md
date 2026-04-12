## ADDED Requirements

### Requirement: Bootstrap pnpm Next.js App Router starter
The system SHALL implement the approved proposal recorded in OpenSpec change `next-starter-a1-p1-bootstrap-pnpm-next-js-app-router-starter`
and keep the work aligned with this proposal's objective: Initialize the empty `ugit` repository as a full-TypeScript Next.js App Router app with a minimal Hello World page, `@/` imports, harness-aligned ESLint/Prettier/Vitest configuration, root `INSTRUCTIONS.md`/`AGENTS.md`/`TODO.md`, required package scripts and dependencies, and passing `pnpm fmt`, `pnpm lint`, `pnpm test`, and `pnpm build`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Bootstrap pnpm Next.js App Router starter" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat: Bootstrap pnpm Next.js App Router starter` and conventional-title metadata `feat`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat: Bootstrap pnpm Next.js App Router starter`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `next-starter-a1-p1-bootstrap-pnpm-next-js-app-router-starter`
