## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Add remote CI runner and auto-merge" and confirm the canonical request/PR title is `feat(pr/runner): implement ugit PR runner`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(pr/runner)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [ ] 2.1 Implement the approved objective: Materialize OpenSpec change `pr-runner-a1-p2-add-remote-ci-runner-and-auto-merge` to consume synchronized PR records, enforce one active CI job per repository and four globally, execute `.ugit/workflows/*` validation packages on the remote repository commit, write `.data/ci-results/<repo>/<branch>.json`, and merge successful pull requests into their base branches with coverage for scheduling and failure behavior.
- [ ] 2.2 Run validation and capture reviewer findings for "Add remote CI runner and auto-merge"
