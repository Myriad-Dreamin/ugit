## Why

`packages/ugit-cli/src/create.ts` currently aborts when a local repository
already has an `origin` remote that differs from the computed ugit URL. That
forces users to stop `ugit create`, update `origin` manually, and retry a flow
that should be guided by the CLI.

This change keeps the `ugit create -m <machine> [directory]` experience safe
for both humans and automation: interactive runs should confirm the override
before replacing `origin`, while non-interactive runs should remain
deterministic and require an explicit override flag instead of hanging or
mutating silently.

## What Changes

- Introduce the
  `origin-override-a1-p1-prompt-before-overriding-origin-remote-during-ugit`
  OpenSpec change for proposal "Prompt before overriding origin remote during
  `ugit create`".
- Update the `ugit create` command flow so Clipanion-owned command handling
  prompts before replacing a conflicting local `origin` remote during
  interactive use.
- Add an explicit non-interactive override path such as `--override-origin` so
  automation can opt into replacing `origin` without a prompt, and refuse the
  conflict deterministically otherwise.
- Extend the repository creation logic so approved overrides replace the local
  `origin` URL with the computed ugit remote instead of failing immediately,
  while declined overrides abort before local `origin` changes.
- Add focused Vitest coverage for interactive accept, interactive decline,
  explicit override, and non-interactive refusal paths, and update CLI help
  plus README guidance for the new behavior.

## Capabilities

### New Capabilities
- `origin-override-a1-p1-prompt-before-overriding-origin-remote-during-ugit`:
  Let `ugit create` confirm and apply conflicting local `origin` replacement in
  a user-friendly way while keeping automation explicit and deterministic.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `fix(cli/create): prompt before overriding origin remote`
- Conventional title metadata: `fix(cli/create)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: make `ugit create` confirm and handle `origin` replacement
  instead of hard-failing on conflicting remotes
- Affected code areas: `packages/ugit-cli/src/commands/create.ts`,
  `packages/ugit-cli/src/create.ts`, `packages/ugit-cli/src/create.test.ts`,
  create-command CLI tests, and `README.md`
- Validation target after implementation: `pnpm fmt`, `pnpm fmt:check`,
  `pnpm lint`, `pnpm test`, and `pnpm build`
- Scope boundaries: no remote initialization redesign, no broader CLI prompt
  framework, and no changes outside `ugit create` origin-conflict handling plus
  its docs and focused tests
- Risks and assumptions:
  - Prompt-on-conflict is the preferred UX; prompting on every `ugit create`
    would add avoidable friction.
  - Non-interactive invocation must stay explicit so CI and scripts never wait
    on stdin.
  - Remote initialization can still partially succeed before a later local
    `origin` update failure, so recovery messaging must remain actionable.
