## Context

This change captures proposal "Initialize server-only SQLite storage" as OpenSpec change `sqlite-storage-a2-p1-initialize-server-only-sqlite-storage`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Create one implementation-ready change that adds a server-only `better-sqlite3` foundation with normalized path resolution, cached shared connections, handwritten migrations and metadata helpers, a small homepage-content storage domain replacing the current static `lib/hello.ts` helper, focused Vitest coverage for `:memory:` and temp-file databases, and full validation through `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
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

Planner deliverable reference: Suggested OpenSpec change: `sqlite-storage-a2-p1-initialize-server-only-sqlite-storage`.\n\nImplementation objective:\n- Add `better-sqlite3` as a direct runtime dependency and add typings only if the chosen version still needs them.\n- Create a small server-only config owner for the SQLite path, likely `lib/storage/config.ts`, with an env override such as `UGIT_STORAGE_PATH` and a repo-relative default like `data/ugit`. Relative paths must resolve from `process.cwd()`, `:memory:` must remain supported for tests, `.sqlite` paths must pass through unchanged, and other file names must normalize to `<path>.sqlite`.\n- Add `lib/storage/sqlite.ts` with an explicit `server-only` import, a `DatabaseSync` alias re-export, normalized storage-location resolution, parent-directory creation, per-path global connection caching, PRAGMA setup (`busy_timeout = 5000`, `foreign_keys = ON`, WAL only for file-backed DBs), `resolveStorageLocation`, `getStorageState`, `withStorage`, `queueStorageMutation`, transaction helper, table-existence helper, and a test-only cache reset that closes cached databases.\n- Build the shared migration system in that module: bootstrap `schema_migrations` and `storage_metadata` if missing, support ordered handwritten migrations with `version`, `name`, and `up(database)`, run them idempotently, apply each migration inside an `IMMEDIATE` transaction, record applied versions, and keep `storage_engine=better-sqlite3`, `created_at`, and `schema_version` synchronized.\n- Choose the homepage greeting as the first storage domain because the current app has no other persisted domain. Replace the current `lib/hello.ts` flow with a server-only module such as `lib/storage/homepage.ts` that defines the domain migration set, keeps timestamps as ISO strings, uses parameterized SQL only, exposes explicit read and mutation helpers, and lets `app/page.tsx` stay thin.\n- Add Vitest coverage for path normalization, cache reuse across equivalent paths, ordered and idempotent migrations, metadata values, `:memory:` migration runs, domain-table creation, and temp-file integration flows. Keep tests in the existing node-based `*.test.ts` pattern and clean up temp files or directories after integration cases.\n- Keep client boundaries safe: only server components or other server code may import `lib/storage/*`. If Next.js build needs native-module externalization for `better-sqlite3`, add the smallest possible `next.config.ts` with `serverExternalPackages`.\n\nAssumptions and risks:\n- There is no existing persistence model, so homepage content is the only coherent first domain.\n- There is no existing config owner for storage path, so creating one is part of the proposal rather than reusing a non-existent config surface.\n- Native-module bundling may require minimal Next.js config even though the repo currently has none.\n\nValidation contract after implementation:\n- `pnpm fmt`\n- `pnpm fmt:check`\n- `pnpm lint`\n- `pnpm test`\n- `pnpm build`\n\nPool coordination: no coder or reviewer lane should start until human approval arrives.
