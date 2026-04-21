## Context

The repository already has the local execution contract this change wants to
standardize: `packages/ugit-cli/src/workflow.ts` runs
`pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
before `pnpm --dir <workflow> run ugit:ci`, and
`packages/ugit-cli/src/workflow.test.ts` already locks that order down.

What is still inconsistent is the scaffolding and guidance around that
contract. The authored and discovery `ugit-ci-setup` skill payloads still
teach a shell-based `run-ugit-ci.sh` wrapper, the workflow-contract and
remote-validation docs still recommend direct `pnpm ... run ugit:ci` local
validation, and the smoke/materialization/parity helpers still hardcode the
shell template inventory. No repository-owned workflow packages are checked
into this repo today, so the work is primarily about aligning templates, docs,
and validation helpers around the existing runner behavior rather than
migrating live workflow packages.

## Goals / Non-Goals

**Goals:**
- Preserve the current local runner install-before-run behavior as the
  authoritative workflow-package contract and align surrounding docs and
  helpers to it.
- Replace the default shell wrapper scaffold with a TypeScript entrypoint for
  new `.ugit/workflows/<workflow>/` packages.
- Keep the TypeScript runtime story explicit, minimal, and compatible with the
  repository's supported Node `>=22.13.0` range.
- Update authored and discovery skill payloads, materialization helpers, smoke
  coverage, and parity tests together so they continue to agree on the
  workflow-package template shape.

**Non-Goals:**
- Redesign `ugit workflow run --local` semantics or remove the existing
  install-before-run step from the CLI.
- Migrate external repositories' existing shell-based workflow packages in this
  change.
- Add new UI, server API, or scheduler behavior unrelated to workflow-package
  scaffolding and validation guidance.
- Introduce package-manager alternatives or a broad rewrite of unrelated repo
  maintenance helpers.

## Decisions

### Decision: Use the existing CLI install-before-run behavior as the source of truth

The change will treat `packages/ugit-cli/src/workflow.ts` and its tests as the
contract, then update skill docs, README guidance, and smoke flows to match
that behavior. This keeps the approved scope focused on alignment rather than
reopening already-implemented CLI semantics.

Alternative considered:
- Change the CLI or documentation wording to make local install behavior
  optional. Rejected because the local runner already enforces install first,
  and relaxing the surrounding contract would only make the developer
  experience less predictable.

### Decision: Scaffold a TypeScript wrapper with native Node execution

New workflow packages will replace `run-ugit-ci.sh` with a TypeScript
entrypoint such as `run-ugit-ci.ts`, and the generated `package.json` will run
it through `node --experimental-strip-types`. The wrapper should stay limited
to simple erasable TypeScript syntax and the existing "return to repo root, then
run the confirmed validation command" behavior so the scaffold remains
cross-platform without adding a separate runtime dependency.

Alternative considered:
- Keep the shell wrapper. Rejected because it works against the repository's
  TypeScript-first direction and is harder to maintain across platforms.
- Add a runtime dependency such as `tsx`. Rejected for the first cut because
  Node `>=22.13.0` can support a simple native TypeScript wrapper and avoiding
  another dependency keeps the workflow package smaller.

### Decision: Keep authored and discovery skill payloads synchronized through the existing helper chain

`skills/ugit-ci-setup` remains the authored source, `.codex/skills/ugit-ci-setup`
remains the discovery copy, and the materialize/export/smoke helpers plus
`lib/codex-skills.test.ts` remain the enforcement layer. The implementation
should update file inventories, template paths, and smoke expectations in one
pass so there is still a single path for materializing or proving the skill
payload.

Alternative considered:
- Update only the authored payload and leave the `.codex` tree or helper file
  lists to catch up later. Rejected because parity failures are the intended
  guardrail and would immediately leave the change incomplete.

### Decision: Make install-first local validation explicit everywhere the workflow package is exercised

README examples, workflow-contract guidance, remote-validation steps,
materialization docs, and smoke scripts will explicitly run
`pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
before `pnpm --dir <workflow> run ugit:ci`. That keeps human instructions and
helper proofs aligned with the local runner contract instead of assuming users
will infer the install step from the CLI implementation.

Alternative considered:
- Leave docs and smoke helpers on direct `pnpm ... run ugit:ci` commands
  because the template may not add dependencies initially. Rejected because the
  contract is about the execution shape, not just whether the first template
  happens to need packages today.

## Risks / Trade-offs

- [Native TypeScript wrapper uses unsupported syntax] -> Keep the generated
  wrapper deliberately small and limited to syntax that `node
  --experimental-strip-types` can execute in the supported Node range.
- [Template rename drift breaks parity tests] -> Update authored and discovery
  file inventories plus helper scripts in the same change and keep
  `lib/codex-skills.test.ts` as the parity gate.
- [Docs or smoke flows regress back to direct `ugit:ci` runs] -> Make the
  install-first sequence explicit in every affected reference and exercise it
  in the smoke helper.
- [Users infer that existing shell-based workflows must migrate immediately] ->
  Keep the change framed as a new default scaffold and contract alignment, not
  a forced migration for already-existing external workflow packages.

## Migration Plan

1. Update the authored skill docs, references, and templates to the TypeScript
   scaffold and install-first local validation story.
2. Refresh the discovery payload, materialization/export helpers, smoke path,
   and parity tests so they all agree on the same file inventory and local
   execution order.
3. Update README and materialization docs to match the new scaffold and local
   validation contract.
4. Validate with formatting, linting, focused tests, and the smoke flow. No
   repository data migration is needed because this repo does not check in
   `.ugit/workflows/*` packages.

Rollback is straightforward: restore the previous skill templates and docs if
the TypeScript runtime approach proves incompatible before approval or merge.

## Open Questions

- None for proposal approval. If `node --experimental-strip-types` proves
  incompatible with the minimum supported Node `22.13.0` runtime during
  implementation, stop and reopen the runtime choice before adding a workflow
  runtime dependency.
