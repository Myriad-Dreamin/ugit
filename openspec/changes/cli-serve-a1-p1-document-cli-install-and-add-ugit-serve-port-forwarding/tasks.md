## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Document CLI install and add `ugit serve` port forwarding" and confirm the canonical request/PR title is `feat(cli/serve): Document CLI install and add `ugit serve` port forwarding`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(cli/serve)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [ ] 2.1 Implement the approved objective: Materialize one OpenSpec change that updates `README.md` with a supported install workflow for the private `ugit` CLI, adds Clipanion command `ugit serve -m <machine> [-p <local-port>]` backed by existing machine config and SSH port forwarding with `local-port` defaulting to `serverPort`, covers tunnel and failure behavior with focused tests, and validates with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [ ] 2.2 Run validation and capture reviewer findings for "Document CLI install and add `ugit serve` port forwarding"
