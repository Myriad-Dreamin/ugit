## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Initialize server-only SQLite storage" and confirm the canonical request/PR title is `feat(storage/sqlite): Initialize server-only SQLite storage`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(storage/sqlite)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [ ] 2.1 Implement the approved objective: Create one implementation-ready change that adds a server-only `better-sqlite3` foundation with normalized path resolution, cached shared connections, handwritten migrations and metadata helpers, a small homepage-content storage domain replacing the current static `lib/hello.ts` helper, focused Vitest coverage for `:memory:` and temp-file databases, and full validation through `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [ ] 2.2 Run validation and capture reviewer findings for "Initialize server-only SQLite storage"
