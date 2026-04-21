## Context

The ugit workflow execution contract already lives in
`packages/ugit-cli/src/workflow-package.ts` and
`lib/pr-runner/workflows.ts`: workflow packages only need a `package.json`
with a `ugit:ci` script, and both local CLI execution and server-side runner
execution install workflow dependencies before running that script.

The drift is in the ugit CI setup skill payload and its proofs:

- `skills/ugit-ci-setup/SKILL.md` and
  `skills/ugit-ci-setup/references/workflow-contract.md` still emphasize the
  bash wrapper `run-ugit-ci.sh` and direct `pnpm --dir <workflow> run ugit:ci`
  local verification.
- `skills/ugit-ci-setup/templates/*`,
  `scripts/materialize-ugit-ci-skill.sh`,
  `scripts/export-ugit-ci-skill-patch.sh`,
  `scripts/smoke-ugit-ci-skill.sh`, and `lib/codex-skills.test.ts` still track
  the shell-wrapper payload.
- `README.md` already documents the runner's install-before-run behavior, so
  the repository mostly needs its authored scaffolding and smoke paths brought
  back into alignment with the real contract.

This change stays cohesive because the skill instructions, template payload,
discovery mirror parity, smoke proof, and any focused runner-contract coverage
all depend on the same install-then-run model.

## Goals / Non-Goals

**Goals:**
- Keep the current install-before-run execution order as the single source of
  truth for ugit-managed workflows.
- Refresh the authored `skills/ugit-ci-setup` payload so the recommended
  scaffold uses a minimal TypeScript entrypoint instead of `run-ugit-ci.sh`.
- Refresh `.codex/skills/ugit-ci-setup` through the existing materialization
  or sync flow so the authored and discovery payloads stay byte-for-byte
  aligned.
- Update smoke proofs, parity tests, and documentation so local verification
  explicitly installs workflow dependencies before invoking `ugit:ci`.
- Add only focused workflow execution order coverage where needed to keep the
  contract explicit and guard against future drift.

**Non-Goals:**
- Introduce a new workflow scheduler, queue policy, worktree lifecycle, or
  workflow REST behavior.
- Require workflow packages to expose anything beyond `package.json` plus a
  `ugit:ci` script.
- Migrate already-generated external repository workflows automatically.
- Eliminate every shell invocation in user-confirmed repository commands; this
  change is limited to ugit-managed scaffolding, proofs, and documentation.

## Decisions

### Decision: Keep the runner contract authoritative

`packages/ugit-cli/src/workflow-package.ts` and
`lib/pr-runner/workflows.ts` already define the runtime contract clearly:
discover a workflow package, validate `package.json` plus `ugit:ci`, install
dependencies, then run `ugit:ci`. The implementation should treat those files
as the source of truth and only make a small refactor or add focused coverage
if doing so reduces duplication or makes the install-before-run behavior easier
to verify.

Alternative considered:
- Reframe the contract primarily in skill docs or template assets. Rejected
  because documentation cannot enforce runtime order and would leave drift
  likely to recur.

### Decision: Keep the authored `skills/` payload canonical

The repository already distinguishes the authored skill under
`skills/ugit-ci-setup` from the repo-local discovery copy under
`.codex/skills/ugit-ci-setup`. This change should update the authored payload
first and then refresh the discovery copy through the existing materialization,
patch-export, or sync flow instead of hand-editing both trees independently.

Alternative considered:
- Update the `.codex/` discovery payload directly and backfill authored files
  later. Rejected because it invites file-list drift and weakens the current
  parity proof model.

### Decision: Replace the shell wrapper with a zero-build TypeScript entrypoint

The recommended workflow scaffold should move from `run-ugit-ci.sh` to a
TypeScript entrypoint such as `run-ugit-ci.ts` that executes after the
runner's `pnpm install` step. The generated workflow package can carry the
smallest runtime dependency set needed to execute that TypeScript file directly
without a separate compile step, so the scaffold stays minimal while gaining
cross-platform maintainability.

Alternative considered:
- Keep the shell wrapper and only update docs. Rejected because it preserves
  the bash-centric guidance that motivated the request.
- Generate compiled JavaScript plus a build step. Rejected because it adds
  unnecessary ceremony to what should remain a tiny workflow package.

### Decision: Make smoke proofs exercise install-then-run explicitly

The concrete proof path should no longer skip installation. The smoke helper
must scaffold a temporary workflow package from the committed templates,
install its dependencies, and only then invoke `ugit:ci`, so the proof matches
what both the CLI and server runner already do.

Alternative considered:
- Keep the current smoke proof as a bare `pnpm --dir <workflow> run ugit:ci`
  invocation because the runtime also installs elsewhere. Rejected because the
  proof would continue validating the wrong local guidance.

### Decision: Keep the workflow contract generic while recommending TypeScript

The skill and docs should recommend TypeScript-first workflow logic, but the
runtime contract must remain generic: any workflow package that defines
`package.json` plus `ugit:ci` remains valid, even if it uses a different
implementation style than the new template.

Alternative considered:
- Make the server or CLI require the new TypeScript scaffold files. Rejected
  because the approved scope is guidance and scaffold alignment, not a breaking
  runtime contract change.

## Conventional Title

- Canonical request/PR title:
  `ci(ugit/ci-setup): adopt install-first TypeScript CI scaffolding`
- Conventional title metadata: `ci(ugit/ci-setup)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter the approved OpenSpec change path
  `ci-scripting-a1-p1-make-ugit-ci-workflow-scaffolding-install-first-and-t`.

## Risks / Trade-offs

- [The new scaffold adds workflow-local runtime dependencies] -> Keep the
  TypeScript execution layer minimal and make install-before-run requirements
  explicit anywhere local smoke or docs previously skipped installation.
- [Authored and discovery payloads can drift] -> Keep the materialization file
  list authoritative and require parity checks to cover every committed skill
  file in the new scaffold.
- [Cross-platform claims can regress if the TypeScript entrypoint shells out
  too aggressively] -> Prefer `node:` APIs and direct process control over
  bash-specific constructs when implementing the template.
- [Runtime contract duplication can survive the doc refresh] -> Add only the
  smallest focused coverage or refactor needed to keep install order and error
  phases explicit in shared helpers.

## Migration Plan

1. Update the authored `skills/ugit-ci-setup` templates, instructions, and
   references for the TypeScript-first scaffold.
2. Refresh the repo-local `.codex/skills/ugit-ci-setup` copy through the
   existing materialization or sync flow and keep the parity test green.
3. Update smoke helpers and documentation to install dependencies before
   invoking `ugit:ci`.
4. Add or adjust focused workflow execution order coverage only where needed.
5. Validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`,
   `pnpm build` when runtime code changes, and
   `./scripts/smoke-ugit-ci-skill.sh`.

Rollback is straightforward because the change is limited to scaffolding,
documentation, and focused contract coverage rather than persisted workflow
state or server-side data migration.

## Open Questions

None beyond the implementation-time choice of the smallest TypeScript runtime
dependency set needed to keep the scaffold zero-build and cross-platform.
