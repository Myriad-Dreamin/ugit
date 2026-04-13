## ADDED Requirements

### Requirement: Initialize server-only SQLite storage
The system SHALL implement the approved proposal recorded in OpenSpec change `sqlite-storage-a3-p1-initialize-server-only-sqlite-storage`
and keep the work aligned with this proposal's objective: Implement one OpenSpec-aligned change that adds a `better-sqlite3`-backed server-only storage layer under `lib/storage/*` with normalized path resolution, cached shared connections, WAL/file-backed pragmas, handwritten migrations, metadata helpers, transaction and mutation utilities, and a test-only cache reset; introduce a small SQLite-backed homepage-content domain and update the home page to read it dynamically without disturbing the existing filesystem-backed repository listing; add Vitest coverage for migration ordering/idempotency, metadata correctness, domain-table creation, cache reuse for equivalent paths, `:memory:` behavior, and temp-file integration; then validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

#### Scenario: Approved proposal enters execution
- **WHEN** a human approves the "Initialize server-only SQLite storage" proposal
- **THEN** the system SHALL queue the proposal into the pooled coding and machine-review workflow

### Requirement: Proposal execution stays isolated
The system SHALL keep proposal execution isolated to the claimed implementation
branch and reusable worktree until human feedback explicitly requests
request-group replanning.

#### Scenario: Dedicated execution workspace
- **WHEN** the coder starts work on this proposal
- **THEN** the system SHALL provide a dedicated implementation branch and a reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N`

### Requirement: Conventional title metadata stays explicit
The system SHALL carry the canonical request/PR title `feat(storage/sqlite): Initialize server-only SQLite storage` and conventional-title metadata `feat(storage/sqlite)`
through the materialized OpenSpec artifacts without encoding slash-delimited roadmap/topic scope into `branchPrefix` or OpenSpec change paths.

#### Scenario: Materialized artifacts mirror the approved scope
- **WHEN** planner materializes this proposal
- **THEN** the generated proposal, design, spec, and tasks SHALL reference the canonical request/PR title `feat(storage/sqlite): Initialize server-only SQLite storage`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path `sqlite-storage-a3-p1-initialize-server-only-sqlite-storage`
