## Why

The local `ugit workflow run --local` path already installs workflow-package
dependencies before it runs `ugit:ci`, but the ugit CI setup skill, workflow
contract docs, README examples, and smoke helpers still center a shell wrapper
and several local validation paths that jump straight to `pnpm ... run
ugit:ci`. That mismatch weakens the documented contract and keeps new workflow
packages on a less maintainable shell-first scaffold even though this
repository is TypeScript-only and targets modern Node.

## What Changes

- Materialize OpenSpec change
  `workflow-ts-ci-a1-p1-workflow-ci-a1-p1-install-before-run-and-favor-type`
  with canonical title
  `ci(workflow/ci): standardize install-first TypeScript CI workflows`.
- Treat the existing local runner behavior in
  `packages/ugit-cli/src/workflow.ts` and
  `packages/ugit-cli/src/workflow.test.ts` as the workflow-package contract,
  and align surrounding docs and helper flows to that install-before-run order
  instead of changing local execution semantics.
- Update the authored and repo-local discovery `ugit-ci-setup` skill payloads
  to scaffold a TypeScript entrypoint in `.ugit/workflows/<workflow>/` instead
  of `run-ugit-ci.sh`, including an explicit Node-based `ugit:ci` runtime
  command that works with the repository's supported Node range.
- Update README, workflow-contract, remote-validation, and materialization docs
  so every local validation example runs
  `pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
  before `pnpm --dir <workflow> run ugit:ci`.
- Update skill materialization, smoke, export, and parity-test helpers to
  track the TypeScript template filenames and the new install-first smoke flow.

## Capabilities

### New Capabilities
- `workflow-ts-ci-a1-p1-workflow-ci-a1-p1-install-before-run-and-favor-type`:
  Standardize ugit CI scaffolding, docs, and helper validation around the
  existing install-before-run contract while making TypeScript the default
  workflow entrypoint template for new workflow packages.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title:
  `ci(workflow/ci): standardize install-first TypeScript CI workflows`
- Conventional title metadata: `ci(workflow/ci)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter the approved OpenSpec change path
  `workflow-ts-ci-a1-p1-workflow-ci-a1-p1-install-before-run-and-favor-type`.

## Impact

- Affected areas: `skills/ugit-ci-setup`, `.codex/skills/ugit-ci-setup`,
  `README.md`, `scripts/materialize-ugit-ci-skill.sh`,
  `scripts/smoke-ugit-ci-skill.sh`,
  `scripts/export-ugit-ci-skill-patch.sh`,
  `skills/ugit-ci-setup/MATERIALIZE.md`, and `lib/codex-skills.test.ts`
- Existing contract source: `packages/ugit-cli/src/workflow.ts` plus
  `packages/ugit-cli/src/workflow.test.ts`
- Scope boundaries: no product UI or server API work, no migration of external
  repositories' existing workflow packages, and no package-manager expansion
  beyond `pnpm`
- Validation expectation: `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, focused
  `pnpm test`, and `pnpm build` when the TypeScript template and helper
  changes touch buildable or linted code paths
- Key risks and assumptions:
  - The TypeScript wrapper runtime needs one explicit supported story for
    Node `>=22.13.0`; the change should prefer a no-extra-dependency approach
    if the minimum supported Node version can execute it reliably.
  - Authored and discovery skill payloads must stay file-for-file aligned or
    helper parity tests will fail.
  - The highest regression risk is inconsistent docs and helper behavior, not
    the already-covered local CLI execution order.
- Approval note: coding and review lanes stay idle until a human approves this
  proposal.
