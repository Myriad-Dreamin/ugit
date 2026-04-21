## Why

The ugit runner already installs workflow package dependencies before invoking
`ugit:ci`, but the repo-local `ugit-ci-setup` skill, its committed templates,
the smoke proof, and parts of the documentation still steer users toward
running `pnpm --dir <workflow> run ugit:ci` directly and wrapping repository
commands in `run-ugit-ci.sh`. That drift hides the real workflow contract and
keeps the recommended scaffold more bash-centric than the current runner
requires.

This change is needed now to make future ugit CI workflow packages match the
existing install-before-run contract by default while moving the recommended
entrypoint to a minimal TypeScript wrapper that is easier to maintain across
platforms.

## What Changes

- Introduce the
  `ci-scripting-a1-p1-make-ugit-ci-workflow-scaffolding-install-first-and-t`
  OpenSpec change for proposal "Make ugit CI workflow scaffolding
  install-first and TypeScript-first".
- Update the authored `skills/ugit-ci-setup` guidance, references, and
  templates so newly scaffolded workflow packages assume install-before-run
  execution and default to a TypeScript entrypoint such as `run-ugit-ci.ts`
  instead of `run-ugit-ci.sh`.
- Refresh materialization, export, sync, parity, and smoke helpers so the
  authored `skills/` payload and the repo-local `.codex/` discovery mirror
  stay aligned and the concrete smoke proof installs workflow dependencies
  before invoking `ugit:ci`.
- Keep `packages/ugit-cli/src/workflow-package.ts` and
  `lib/pr-runner/workflows.ts` as the authoritative runner contract, adding
  only the smallest refactor or focused coverage needed to keep the
  install-then-run behavior explicit and protected.
- Update `README.md` and related skill documentation so local verification
  guidance explicitly installs workflow package dependencies before running
  `ugit:ci`, while continuing to route remote validation through the existing
  `ugit workflow run` and `ugit workflow logs` commands.

## Capabilities

### New Capabilities
- `ci-scripting-a1-p1-make-ugit-ci-workflow-scaffolding-install-first-and-t`:
  Align ugit CI workflow scaffolding, proof tooling, and documentation around
  the existing install-before-run runner contract and a TypeScript-first
  workflow entrypoint.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title:
  `ci(ugit/ci-setup): adopt install-first TypeScript CI scaffolding`
- Conventional title metadata: `ci(ugit/ci-setup)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter the approved OpenSpec change path
  `ci-scripting-a1-p1-make-ugit-ci-workflow-scaffolding-install-first-and-t`.

## Impact

- Affected repository: `ugit`
- Planner deliverable: Proposal:
  `Make ugit CI workflow scaffolding install-first and TypeScript-first`
- Planner summary: One OpenSpec-aligned change keeps ugit workflow execution
  install-first and refreshes the CI setup skill, templates, smoke tooling,
  and docs around a TypeScript-first scaffold.
- Affected code areas: `skills/ugit-ci-setup/**/*`,
  `.codex/skills/ugit-ci-setup/**/*` through the existing materialization
  flow, `scripts/materialize-ugit-ci-skill.sh`,
  `scripts/export-ugit-ci-skill-patch.sh`,
  `scripts/smoke-ugit-ci-skill.sh`, `lib/codex-skills.test.ts`,
  `README.md`, and focused workflow execution contract coverage near
  `packages/ugit-cli/src/workflow-package.ts` and
  `lib/pr-runner/workflows.ts`
- Validation target after implementation: `pnpm fmt`, `pnpm fmt:check`,
  `pnpm lint`, `pnpm test`, `pnpm build` when runtime code changes, and
  `./scripts/smoke-ugit-ci-skill.sh`
- Scope boundaries:
  - no new CI scheduler, worktree, queue, or workflow REST behavior
  - no migration of already-generated external repository workflows
  - no framework-specific CI template catalog
  - no new server-side workflow shape beyond `package.json` plus `ugit:ci`
- Risks and assumptions:
  - The runner already installs before running today, so the main risk is
    contract drift across docs, templates, and smoke proofs rather than missing
    execution support.
  - A TypeScript-first scaffold adds a small workflow-package runtime
    dependency, so the generated package should keep that footprint minimal and
    explicit.
  - Cross-platform gains only hold if the TypeScript template uses Node APIs
    instead of reintroducing shell-specific behavior through a different
    wrapper.
  - The authored `skills/` payload and tracked `.codex/` mirror must stay
    byte-for-byte aligned after the refresh.
- Approval note: the coding-review pool stays idle until a human approves this
  proposal.
