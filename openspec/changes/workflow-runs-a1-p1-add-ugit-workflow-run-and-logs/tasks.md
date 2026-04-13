## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Add ugit workflow run and logs" and confirm the canonical request/PR title is `feat(workflow/runs): Add ugit workflow run and logs`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(workflow/runs)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [ ] 2.1 Implement the approved objective: Materialize OpenSpec change `workflow-runs-a1-p1-add-ugit-workflow-run-and-logs` with canonical title `feat(workflow/runs): Add ugit workflow run and logs`. Add Clipanion `ugit workflow run [workflow]` and `ugit workflow logs [workflowId]` commands, workflow-run request and log-stream contracts over HTTP-over-SSH, durable workflow-run metadata plus append-only log storage keyed by workflowId, targeted single-workflow execution on the existing CI runner, shared one-per-repo and four-global queue limits with PR jobs, README/help updates, focused Vitest coverage, and validation with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [ ] 2.2 Run validation and capture reviewer findings for "Add ugit workflow run and logs"
