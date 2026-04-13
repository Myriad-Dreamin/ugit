## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Seed `.data/repos` example repository and expose repository listing over HTTP" and confirm the canonical request/PR title is `feat(repositories/http): Seed `.data/repos` example repository and expose`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(repositories/http)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [ ] 2.1 Implement the approved objective: Assuming the approved starter baseline is present in the claimed worktree, implement a server-only repository module rooted at `.data/repos`, idempotently ensure `example-repo` exists as a real Git repository, expose discovered repositories through `GET /api/repositories` and the main HTTP page, add ignore rules and Vitest coverage, and validate with `pnpm fmt`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [ ] 2.2 Run validation and capture reviewer findings for "Seed `.data/repos` example repository and expose repository listing over HTTP"
