## 1. Proposal Alignment

- [x] 1.1 Review the approved OpenSpec artifacts for "Initialize server-only SQLite storage" and confirm the canonical request/PR title is `feat(storage/sqlite): Initialize server-only SQLite storage`
- [x] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(storage/sqlite)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [x] 2.1 Implement the approved objective: Implement one OpenSpec-aligned change that adds a `better-sqlite3`-backed server-only storage layer under `lib/storage/*` with normalized path resolution, cached shared connections, WAL/file-backed pragmas, handwritten migrations, metadata helpers, transaction and mutation utilities, and a test-only cache reset; introduce a small SQLite-backed homepage-content domain and update the home page to read it dynamically without disturbing the existing filesystem-backed repository listing; add Vitest coverage for migration ordering/idempotency, metadata correctness, domain-table creation, cache reuse for equivalent paths, `:memory:` behavior, and temp-file integration; then validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [x] 2.2 Run validation and capture reviewer findings for "Initialize server-only SQLite storage"
