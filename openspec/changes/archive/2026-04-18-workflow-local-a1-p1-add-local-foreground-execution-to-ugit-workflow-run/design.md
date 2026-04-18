## Context

`packages/ugit-cli/src/commands/workflow-run.ts` currently always resolves a
configured machine and calls the remote queue path in
`packages/ugit-cli/src/workflow.ts`. The current README and workflow-run
contract assume that `ugit workflow run` always publishes the branch, queues a
remote run, emits a `workflowId`, and pairs with `ugit workflow logs`.

The requested `--local` mode adds a second execution model: foreground local
debugging against the current repository working tree, including uncommitted
changes. That path needs to stay CLI-only, skip all machine or server
interactions, and still mirror the remote workflow package contract closely
enough that debugging locally is representative of what the remote runner will
do.

## Goals / Non-Goals

**Goals:**
- Add an explicit `--local` execution mode to `ugit workflow run` without
  changing the current default remote queued behavior.
- Keep local mode in the CLI, resolve only the repository root, and avoid
  machine resolution, branch publishing, SSH tunneling, queue APIs, and
  workflow IDs.
- Share or mirror the existing `.ugit/workflows/<workflow>` package validation
  plus `pnpm install` and `ugit:ci` command contract so local and remote runs
  stay aligned.
- Run the local install and workflow commands as foreground terminal-attached
  child processes, forwarding `SIGINT`, `SIGTERM`, and `SIGHUP`.
- Update help text, README guidance, and focused Vitest coverage for the new
  local-versus-remote split.

**Non-Goals:**
- Change remote workflow queueing, storage, durable logs, or the managed remote
  `workflow1` worktree behavior.
- Add local workflow history, workflow IDs, retry or cancel controls, or
  `ugit workflow logs` support for local runs.
- Solve every shell-specific terminal-close edge case beyond direct foreground
  execution and explicit signal forwarding.

## Decisions

- Keep `--local` as an explicit mode flag on `ugit workflow run` instead of
  adding a new subcommand.
  Rationale: this preserves the current command surface and makes the local
  debug path discoverable exactly where users already queue manual workflows.
  Alternative considered: a second command such as `ugit workflow local-run`
  would duplicate help and examples while increasing the chance that the wrong
  path becomes the default mental model.

- Treat `--local` as mutually exclusive with remote-only flags such as
  `-m,--machine` and `-p,--port`.
  Rationale: local mode does not need machine selection or an SSH tunnel, so
  accepting those flags would imply server involvement that does not exist.
  Alternative considered: silently ignoring the remote-only flags in local
  mode, which would hide user mistakes and make debugging command invocations
  ambiguous.

- Factor the workflow-package contract into a CLI-safe shared helper, or mirror
  that contract through a small dedicated CLI helper if extraction is smaller
  risk.
  Rationale: the local path needs the same workflow discovery, `package.json`
  validation, and `ugit:ci` command construction as the remote runner, but the
  current server implementation in `lib/pr-runner/workflows.ts` is marked
  `server-only` and also bundles buffered-output concerns that the CLI does not
  want. The implementation should therefore share the contract at the smallest
  practical seam instead of importing server-only code into the CLI.
  Alternative considered: duplicate workflow validation logic directly in the
  command handler, which would drift quickly from the remote runner contract.

- Execute local runs through direct child processes attached to the caller
  terminal, with explicit signal forwarding to the currently active child.
  Rationale: the local mode is meant to be interactive and terminal-bound.
  Using foreground child processes with inherited stdio keeps prompts, colors,
  and streamed output intact, while explicit forwarding of `SIGINT`, `SIGTERM`,
  and `SIGHUP` covers Ctrl-C and terminal shutdown semantics.
  Alternative considered: reuse buffered async-runner helpers or pipe output
  through higher-level wrappers, which would weaken the interactive debugging
  experience and make terminal-close behavior less faithful.

- Document the remote and local execution models as distinct paths.
  Rationale: users need to know that the default command still queues a durable
  remote run with workflow IDs and `ugit workflow logs`, while `--local` is an
  in-place debugging path with no durable record and with possible local cache
  mutations.
  Alternative considered: describing `--local` as a minor option on the remote
  flow, which would blur the contract and create false expectations about logs
  and history.

## Risks / Trade-offs

- [Local install mutates working-copy artifacts] -> Document clearly that local
  runs may reuse or change dependency caches under `.ugit/workflows/<workflow>`
  and are intended for debugging against the current working tree.
- [Signal behavior varies by shell and OS] -> Keep the implementation simple
  with direct foreground children, cover explicit signal forwarding in tests,
  and expect one small manual smoke check for terminal-close behavior.
- [Shared helper extraction can touch both CLI and runner code] -> Keep the
  shared seam limited to workflow discovery, validation, and command
  construction so remote queueing and runner storage behavior stay unchanged.
- [Users may expect `workflow logs` for local runs] -> Make CLI help and README
  state that `workflow logs` only applies to remote queued runs.

## Migration Plan

No data migration is required. The change ships as a CLI and documentation
update, and rollback is straightforward because omitting `--local` preserves
the existing remote queue path unchanged.

## Open Questions

None beyond implementation-time smoke verification of terminal-close behavior
on the supported shell environments.
