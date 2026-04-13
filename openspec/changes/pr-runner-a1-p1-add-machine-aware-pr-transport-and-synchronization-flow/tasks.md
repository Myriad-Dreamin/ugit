## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Add machine-aware PR transport and synchronization flow" and confirm the canonical request/PR title is `feat(pr/runner): implement ugit PR runner`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(pr/runner)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [ ] 2.1 Implement the approved objective: Materialize OpenSpec change `pr-runner-a1-p1-add-machine-aware-pr-transport-and-sync` to extend the existing Clipanion CLI with machine inference, `ugit serve`, and PR publish/synchronize commands, add shared SSH and HTTP transport helpers, and add server-side PR intake and persistence so repositories can register pull requests against a configured ugit machine without replanning `ugit create`.
- [ ] 2.2 Run validation and capture reviewer findings for "Add machine-aware PR transport and synchronization flow"
