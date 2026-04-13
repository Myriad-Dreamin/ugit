## Context

This change captures proposal "Document CLI install and add `ugit serve` port forwarding" as OpenSpec change `cli-serve-a1-p1-document-cli-install-and-add-ugit-serve-port-forwarding`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Materialize one OpenSpec change that updates `README.md` with a supported install workflow for the private `ugit` CLI, adds Clipanion command `ugit serve -m <machine> [-p <local-port>]` backed by existing machine config and SSH port forwarding with `local-port` defaulting to `serverPort`, covers tunnel and failure behavior with focused tests, and validates with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
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

Planner deliverable reference: Proposal: `Document CLI install and add \`ugit serve\`` Suggested OpenSpec change: `ugit-cli-serve-a1-p1-document-cli-install-and-add-serve-command` Why one proposal: - The README install flow and `ugit serve` share the same CLI package shape, machine config, and `serverPort` contract. - Splitting docs and implementation would create avoidable drift because the install instructions depend on the exact command/package behavior shipped in the same change. Repository context: - `README.md` currently documents only `ugit create` and still lists `ugit serve` as planned follow-up scope. - `packages/ugit-cli/src/cli.ts` registers only `CreateCommand`. - `packages/ugit-cli/src/config.ts` already parses `serverPort`, so the missing command can reuse existing config and machine resolution instead of introducing new config surface. Implementation objective: - Update the README so it documents a real, supported way to install the current private workspace CLI and so `ugit serve` is described as current behavior rather than future scope. - Add `ugit serve -m <machine> [-p <local-port>]` to the Clipanion CLI. The command should default `local-port` to the configured `serverPort`, create an SSH tunnel to the configured ugit machine, and keep that tunnel open until the user stops it. Expected implementation shape: - Add a dedicated `ServeCommand` under `packages/ugit-cli/src/commands/` and register it in `packages/ugit-cli/src/cli.ts`. - Put port-forwarding logic in a separate helper module so SSH argument construction and error handling are unit-testable without real network access. - Reuse `loadConfig` and `resolveMachine`; keep `-m/--machine` required for this slice instead of expanding scope into repository-local machine inference. - Build the tunnel around an SSH local forward such as `ssh -N -L <localPort>:127.0.0.1:<serverPort> <sshMachine>` and preserve clear exit/error behavior in the CLI. - Update README sections for prerequisites, config semantics, CLI install steps, `ugit serve` usage examples, default-port behavior, and tunnel shutdown. - Decide the install path that is truthful for the current private package, likely a build plus global-link workflow; add a small script or metadata adjustment only if needed to make the documented flow actually work. - Add focused tests for serve option parsing, default port resolution, SSH command construction, and child-process failure propagation while keeping `ugit create` behavior unchanged. Validation contract: - `pnpm fmt` - `pnpm fmt:check` - `pnpm lint` - `pnpm test` - `pnpm build` Scope boundaries: - No PR publish or synchronize commands. - No CI queueing, merge automation, or `.data/ci-results` work. - `ugit serve` forwards to an already running remote ugit HTTP service; it does not start or supervise that service. - No automatic machine lookup from Git config for `serve` unless implementation remains trivial and explicitly stays within reviewable scope. Assumptions and risks: - “Finish serve” is interpreted as port forwarding only, not remote server startup. - The install instructions must match the current private workspace packaging; if the existing package metadata makes that awkward, the approved implementation may need a small packaging/script follow-up inside the same change. - `local`/`localhost` behavior needs an explicit call during implementation. Recommended default: keep `serve` SSH-based even for `ssh-machine: localhost` so custom local-port forwarding works consistently, and document that expectation if localhost SSH is required. Conventional title: - Canonical request/PR title: `feat(ugit/cli): Document CLI install and add \`ugit serve\`` - Conventional title metadata: `feat(ugit/cli)` - Keep slash-delimited scope in conventional-title metadata rather than `branchPrefix` or the OpenSpec change path. Approval note: - Materialize this as one OpenSpec change after approval. - Coding-review lanes should stay idle until a human approves the proposal.
