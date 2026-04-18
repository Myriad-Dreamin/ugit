## Context

`packages/ugit-cli/src/create.ts` resolves the repository, validates
`upstream`, computes the ugit `origin`, and currently throws before any remote
setup when an existing local `origin` differs from that computed URL.
`packages/ugit-cli/src/commands/create.ts` is thin today, but it already owns
the Clipanion command context and stdout/stderr streams, which makes it the
right layer to decide whether an interactive prompt is allowed.

The requested change is narrow but crosses command parsing, terminal behavior,
repository mutation, tests, and documentation. The implementation must support
three distinct flows without changing other `ugit create` preconditions:
interactive approval, interactive refusal, and deterministic non-interactive
behavior via an explicit override flag. The artifacts for this change must also
preserve the canonical request/PR title
`fix(cli/create): prompt before overriding origin remote` and conventional-title
metadata `fix(cli/create)` while remaining blocked pending human approval.

## Goals / Non-Goals

**Goals:**
- Prompt only when `ugit create` detects a conflicting local `origin` and stdin
  is interactive.
- Keep prompt orchestration in the Clipanion command layer and pass an explicit
  origin-conflict decision into repository creation logic.
- Replace the local `origin` with `git remote set-url origin <computed-url>`
  when the user approves or when automation passes an explicit override flag.
- Abort cleanly before changing the local `origin` when the user declines or
  when a non-interactive run lacks the explicit override flag.
- Extend tests and docs so the prompt, decline path, override flag, and help
  text stay pinned.

**Non-Goals:**
- Change how remote ugit repositories are initialized or how `upstream` is
  copied to them.
- Introduce a reusable prompt framework for unrelated commands.
- Relax existing errors for missing `upstream`, unknown machines,
  pre-existing remote repository paths, or already-correct `origin` remotes.
- Redesign `ugit create` output beyond the minimal prompt/override guidance
  required for this conflict path.

## Decisions

- Detect the conflicting `origin` early, but move the override decision out of
  the repository core and into the command layer.
  Rationale: `CreateCommand` already owns Clipanion context, terminal streams,
  and the distinction between interactive and non-interactive runs. Keeping the
  prompt there avoids leaking TTY concerns into `create.ts`.
  Alternative considered: prompt directly inside `createRepository`. Rejected
  because it would couple core repository orchestration to terminal I/O and
  complicate tests for deterministic automation.

- Add an explicit boolean override option such as `--override-origin` and pass a
  concrete conflict-resolution choice into `createRepository`.
  Rationale: scripts need a deterministic, opt-in way to replace `origin`
  without reading stdin, and the core logic should receive one resolved choice
  instead of inferring interactivity itself.
  Alternative considered: treat non-interactive runs as implicit approval.
  Rejected because silently replacing `origin` in CI or scripts would be unsafe.
  Alternative considered: force all users to edit `origin` manually first.
  Rejected because it preserves the current UX defect.

- Keep remote repository setup behavior unchanged, then update the local
  `origin` with either `git remote add` or `git remote set-url` based on the
  resolved conflict decision.
  Rationale: the request is specifically about the local `origin` conflict, so
  the least risky design preserves current remote initialization and only
  changes the final local-origin mutation step.
  Alternative considered: rewrite the entire creation flow around a new
  transaction or rollback mechanism. Rejected because it broadens scope beyond
  the approved CLI UX fix.

- Add focused tests at both the command and repository layers.
  Rationale: the prompt and non-interactive refusal path belong to command
  tests, while `git remote set-url origin ...` orchestration belongs to
  `create.ts` tests. Splitting coverage by layer keeps the behavior precise.
  Alternative considered: test only through end-to-end command execution.
  Rejected because mocked repository-layer tests are still needed to pin the
  exact git mutation behavior and error handling.

## Conventional Title

- Canonical request/PR title: `fix(cli/create): prompt before overriding origin remote`
- Conventional title metadata: `fix(cli/create)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [Prompt implementation drifts from Clipanion context expectations] ->
  Confine prompt logic to `packages/ugit-cli/src/commands/create.ts` and test
  interactive versus non-interactive contexts directly.
- [Automation hangs or mutates unexpectedly] -> Require `--override-origin`
  when stdin is not interactive and return an actionable refusal error without
  prompting.
- [Remote repository initialization succeeds before local `origin` update
  fails] -> Preserve actionable error messaging so users know the remote repo
  exists and the remaining manual recovery step is `git remote set-url origin`.
- [Test coverage misses one path] -> Add focused Vitest cases for accept,
  decline, explicit override, and non-interactive refusal instead of relying on
  a single happy-path test.

## Migration Plan

- No persistent data migration is required. The change is limited to
  `ugit create` option parsing, conflict handling, focused tests, and
  documentation.
- Extend the command to detect origin conflicts, prompt only when interactive,
  and pass the resolved choice into `createRepository`.
- Update repository creation so approved conflicts use
  `git remote set-url origin <originUrl>` while fresh repositories still use
  `git remote add origin <originUrl>`.
- Refresh CLI help text and README guidance so users know when the prompt
  appears and how to use the explicit override flag in scripts.
- Rollback is straightforward: remove the new command option and prompt path,
  restore the current hard failure for conflicting `origin` remotes, and keep
  the rest of `ugit create` unchanged.

## Open Questions

- None.
