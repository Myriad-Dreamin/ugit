## Context

This change captures proposal "Initialize server-only SQLite storage" as OpenSpec change `sqlite-storage-a3-p1-initialize-server-only-sqlite-storage`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Implement one OpenSpec-aligned change that adds a `better-sqlite3`-backed server-only storage layer under `lib/storage/*` with normalized path resolution, cached shared connections, WAL/file-backed pragmas, handwritten migrations, metadata helpers, transaction and mutation utilities, and a test-only cache reset; introduce a small SQLite-backed homepage-content domain and update the home page to read it dynamically without disturbing the existing filesystem-backed repository listing; add Vitest coverage for migration ordering/idempotency, metadata correctness, domain-table creation, cache reuse for equivalent paths, `:memory:` behavior, and temp-file integration; then validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- Preserve a reviewable OpenSpec contract before coding starts.
- Keep the proposal logical enough that any pooled worker can execute it.
- Reuse a managed worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` for cache-friendly execution.

**Non-Goals:**
- Bind this proposal to a specific branch or worker slot before approval.
- Expand scope beyond the approved proposal without human feedback.
- Merge sibling proposals into a single coding pass without replanning.

## Decisions

- Store the proposal as a dedicated OpenSpec change before coding begins.
- Let the pooled coding-review runtime allocate execution branches and worktrees after approval.
- Use planner output as the starting point for reviewer validation and follow-up tasks.
- Prefer incremental implementation that can be requeued after machine review feedback.
- Keep the canonical request/PR title as `feat(storage/sqlite): Initialize server-only SQLite storage`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(storage/sqlite)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(storage/sqlite): Initialize server-only SQLite storage`
- Conventional title metadata: `feat(storage/sqlite)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: `Initialize server-only SQLite storage` Why a single proposal: The request is one cohesive server-side storage slice. The shared `better-sqlite3` foundation, handwritten migrations, metadata helpers, one domain module, and the thin App Router integration all depend on the same storage contract. Keeping them together gives the owner one clear approval decision and lets a coding lane finish with one validation pass. Implementation objective: Extend `ugit` with a server-only SQLite storage foundation that follows the repo’s existing `.data` path conventions without disturbing the current filesystem-backed repository listing. Add a shared `lib/storage/sqlite.ts` module for normalized path resolution, cached connections, SQLite pragmas, migrations, metadata, transactions, and mutation helpers. Use that shared layer to introduce one small domain module for homepage content, update the home page to read from storage at request time, and add Vitest coverage for in-memory and temp-file database behavior. Concrete repo context to honor: - Server-side utilities currently live in `lib/` and are consumed by `app/page.tsx` and `app/api/repositories/route.ts`. - Existing persistence is `.data/repos` in `lib/repositories.ts`; there is no current database or ORM. - There is no dedicated config file for storage paths, so the change should centralize the SQLite path inside the new storage helper rather than spread it across the app. - Validation commands already available are `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`. Expected implementation shape: - Add `better-sqlite3` support and keep storage modules server-only. - Create `lib/storage/sqlite.ts` with: - exported `DatabaseSync` alias from `better-sqlite3`; - path resolution rooted at `process.cwd()`; - `:memory:` support; - `.sqlite` suffix normalization; - automatic parent-directory creation; - `busy_timeout = 5000`, `foreign_keys = ON`, and WAL for file-backed databases only; - one cached connection per resolved SQLite path in server-only global state; - a test-only cache reset helper that closes cached databases; - migration bootstrap for `schema_migrations` and `storage_metadata`; - idempotent ordered migrations executed inside `BEGIN IMMEDIATE` transactions; - helpers for resolving storage location, reading storage state/metadata, applying migrations, queuing mutations, running transactions, and checking table existence. - Introduce a domain module such as `lib/storage/homepage.ts` because homepage copy is the cleanest actual repo need to migrate off static data, while repository discovery should stay filesystem-backed under `.data/repos`. - Update `app/page.tsx` to read homepage content through the storage domain and keep the page dynamic at request time. - Add focused tests for migration ordering/idempotency, metadata synchronization, domain-table creation, cache reuse across equivalent paths, `:memory:` migrations, and temp `.sqlite` integration flows. - Keep SQL parameterized and timestamps as ISO strings. Scope boundaries: - Do not migrate repository discovery into SQLite. - Do not add client-side SQLite usage. - Do not introduce an ORM or unrelated abstractions. - Keep route handlers and server components thin by pushing storage logic into `lib/storage/*`. Assumptions and risks: - `better-sqlite3` native build support in the existing Node environment is assumed. - Because no config module currently owns the SQLite path, the coder may need to introduce a small path constant/helper as part of the shared storage layer. - If mutable homepage content is served from SQLite, the page must opt out of static capture; otherwise the storage change will appear to work in tests but not at runtime after build. Approval note: This should materialize as one OpenSpec change. Coding and review lanes stay idle until human approval.
