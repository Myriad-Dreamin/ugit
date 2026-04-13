## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Add ugit CI setup skill and manual workflow runs" and confirm the canonical request/PR title is `feat(workflow/ci): Add ugit CI setup skill and manual workflow runs`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(workflow/ci)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [ ] 2.1 Implement the approved objective: Materialize OpenSpec change `workflow-skill-a1-p1-add-ugit-ci-setup-skill` to add a repo-local Codex skill for authoring `.ugit/workflows/<workflow>` packages, extend the Clipanion CLI with `ugit workflow run` and `ugit workflow logs`, add shared server-side workflow run/list/log APIs plus durable queue/log storage that reuses ugit's CI concurrency limits, surface workflow history and status in the Next.js repository UI, and cover the new contracts with documentation and repository-standard validation.
- [ ] 2.2 Run validation and capture reviewer findings for "Add ugit CI setup skill and manual workflow runs"
