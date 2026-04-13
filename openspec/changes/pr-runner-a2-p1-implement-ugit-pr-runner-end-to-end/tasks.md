## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Implement ugit PR runner end-to-end" and confirm the canonical request/PR title is `feat(pr/runner): Implement ugit PR runner end-to-end`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(pr/runner)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [ ] 2.1 Implement the approved objective: Materialize OpenSpec change `pr-runner-a1-p1-implement-ugit-pr-runner` to extend the existing `ugit create` baseline with machine-aware `ugit serve`, PR publication and synchronization over HTTP-over-SSH, server-side PR intake and durable job state, CI queueing with one active job per repository and four active jobs globally, isolated execution of `.ugit/workflows/*` packages at the queued commit, `.data/ci-results/<repo>/<branch>.json` artifacts, fast-forward auto-merge for green pull requests, focused Vitest coverage, updated README documentation, and validation with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [ ] 2.2 Run validation and capture reviewer findings for "Implement ugit PR runner end-to-end"
