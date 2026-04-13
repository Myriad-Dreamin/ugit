## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Document CLI install and add `ugit serve` port forwarding" and confirm the canonical request/PR title is `feat(cli/serve): Document CLI install and add `ugit serve` port forwarding`
- [ ] 1.2 Confirm the proposal is ready for pooled execution, the reusable worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` can be claimed, and conventional-title metadata `feat(cli/serve)` stays separate from `branchPrefix` and change paths

## 2. Implementation

- [ ] 2.1 Implement the approved objective: Materialize OpenSpec change `ugit-cli-serve-a2-p1-document-cli-install-and-add-port-forward-command` to extend the existing `ugit-cli` package with a documented private CLI install workflow in `README.md`, add `ugit serve -m <machine> [-p <local-port>]` as an SSH local port-forward command that defaults `local-port` to the configured `serverPort`, cover the command and failure behavior with focused Vitest tests, and validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [ ] 2.2 Run validation and capture reviewer findings for "Document CLI install and add `ugit serve` port forwarding"
