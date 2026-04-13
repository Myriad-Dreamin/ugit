## 1. Proposal Alignment

- [x] 1.1 Review the approved OpenSpec artifacts for "Finish ugit PR list/create/edit command set" and confirm the canonical request/PR title is `feat(pr/commands): Finish ugit PR list/create/edit command set`
- [x] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(pr/commands)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [x] 2.1 Implement the approved objective: Materialize the OpenSpec-aligned change `pr-commands-a1-p1-finish-ugit-pr-list-create-edit` to add `gh pr`-inspired, non-interactive `ugit pr list`, `ugit pr create`, and `ugit pr edit` commands over the existing `pr sync` and PR-runner foundation, including shared pull-request summary/query/update contracts, repository-scoped server read/edit APIs over HTTP-over-SSH, storage queries for listing and editing PRs plus latest CI state, README and CLI help updates that clarify `create` vs `edit` vs `sync`, focused Vitest coverage, and validation with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [x] 2.2 Run validation and capture reviewer findings for "Finish ugit PR list/create/edit command set"
