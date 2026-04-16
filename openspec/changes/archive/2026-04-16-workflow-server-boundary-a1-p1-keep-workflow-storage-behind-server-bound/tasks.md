## 1. Proposal Alignment

- [x] 1.1 Review the approved OpenSpec artifacts for "Keep workflow storage behind server boundaries" and confirm the canonical request/PR title is `fix(workflows/storage): move workflow storage server-side`
- [x] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `fix(workflows/storage)` stays separate from `branchPrefix` and change paths

## 2. Workflow Read Boundary

- [x] 2.1 Refactor the workflow list and detail pages so repository lookup stays server-side and browser client props no longer carry raw `repositoryPath` values
- [x] 2.2 Update the workflow list, detail, and log read contracts so route handlers resolve repository context on the server before calling SQLite-backed workflow storage
- [x] 2.3 Narrow browser-facing workflow read DTOs to repo-safe fields while preserving workflow summaries, detail status polling, and live log streaming behavior

## 3. Verification

- [x] 3.1 Add regression coverage for workflow page render contracts, repo-mismatch and not-found behavior, and the updated workflow list, detail, and log read APIs
- [x] 3.2 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, targeted `pnpm test`, and `pnpm build` when feasible
