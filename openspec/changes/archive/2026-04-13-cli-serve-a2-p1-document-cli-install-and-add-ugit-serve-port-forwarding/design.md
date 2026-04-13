## Context

This change captures proposal "Document CLI install and add `ugit serve` port forwarding" as OpenSpec change `cli-serve-a2-p1-document-cli-install-and-add-ugit-serve-port-forwarding`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Materialize OpenSpec change `ugit-cli-serve-a2-p1-document-cli-install-and-add-port-forward-command` to extend the existing `ugit-cli` package with a documented private CLI install workflow in `README.md`, add `ugit serve -m <machine> [-p <local-port>]` as an SSH local port-forward command that defaults `local-port` to the configured `serverPort`, cover the command and failure behavior with focused Vitest tests, and validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- Preserve a reviewable OpenSpec contract before coding starts.
- Keep the proposal logical enough that any pooled worker can execute it.
- Reuse a managed worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` for cache-friendly execution.

**Non-Goals:**
- Bind this proposal to a specific branch or worker slot before approval.
- Expand scope beyond the approved proposal without human feedback.
- Merge sibling proposals into a single coding pass without replanning.

## Decisions

- Store the proposal as a dedicated OpenSpec change before coding begins.
- Let the pooled coding-review runtime allocate execution branches and worktrees after approval.
- Use planner output as the starting point for reviewer validation and follow-up tasks.
- Prefer incremental implementation that can be requeued after machine review feedback.
- Keep the canonical request/PR title as `feat(cli/serve): Document CLI install and add `ugit serve` port forwarding`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(cli/serve)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(cli/serve): Document CLI install and add `ugit serve` port forwarding`
- Conventional title metadata: `feat(cli/serve)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: Document CLI install and add `ugit serve` port forwarding Suggested OpenSpec change: `ugit-cli-serve-a2-p1-document-cli-install-and-add-port-forward-command` Why one proposal: - The requested README install guidance and `ugit serve` behavior both sit on the same existing `packages/ugit-cli` package, machine config schema, and validation pipeline. - The repo already contains the initial `create` slice, so the correct next step is one focused extension of that CLI rather than multiple parallel workstreams. Concrete repo context to honor: - `README.md` currently documents only `ugit create` and explicitly leaves `ugit serve` as future scope. - `packages/ugit-cli/src/cli.ts` registers only `CreateCommand` today, while `config.ts` already exposes `serverPort`, `sshMachine`, and machine resolution helpers. - Root scripts already expect `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build` to pass across the workspace. Implementation objective: - Update `README.md` to document one supported install workflow for this private CLI from the monorepo, then document `ugit serve -m <machine> [-p <local-port>]`, the config file shape, and how the forwarded URL is reached locally. - Add a Clipanion `serve` command plus a dedicated runtime/helper module that resolves the selected machine from `~/.local/share/ugit/config.json`, defaults `local-port` to the machine `serverPort`, and starts SSH local port forwarding to the ugit server. - Keep the command terminal-attached, print the effective forwarded address, and return actionable errors for unknown machines, invalid ports, and SSH forwarding failures. - Add focused Vitest coverage for command registration, default port selection, SSH argument construction, and failure paths. - Validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`. Expected implementation shape: - Extend the CLI registration in `packages/ugit-cli/src/cli.ts` with a new `ServeCommand`. - Introduce a small `serve` execution module so port-forwarding behavior is testable without exercising a real SSH session. - Use the existing config loader and machine resolution helpers instead of creating a second config path. - Prefer a fast-fail SSH invocation suitable for port forwarding, for example with explicit local/remote port mapping and forward-startup failure detection. - Keep README updates narrowly focused on installation, config, `create`, and `serve` usage so the docs match the shipped CLI surface. Scope boundaries: - Do not reopen initial workspace/bootstrap work. - Do not materially change `ugit create` behavior except for shared helper extraction if needed. - Do not implement publish/synchronize PR commands, CI execution, merge automation, or `.data/ci-results` handling. - Do not expand this pass into automatic machine lookup from local git config unless it falls out trivially without changing the explicit `-m` contract. Assumptions and risks: - Because `ugit-cli` is private and not published, the README should present one authoritative install path, preferably build plus global link, rather than multiple ambiguous options. - The safest first cut for `serve` is one SSH-backed code path keyed off `ssh-machine` and `serverPort`; if localhost targets should bypass SSH entirely, that should be approved explicitly. - The coder should surface SSH startup failures clearly instead of leaving a hanging tunnel command with no explanation. Approval note: - Materialize this as one OpenSpec change. - The pooled coding-review lanes stay idle until a human approves the proposal.
