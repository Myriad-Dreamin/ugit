## ADDED Requirements

### Requirement: ugit CI scaffolding defaults to a TypeScript workflow entrypoint
The repository SHALL make TypeScript the default scaffold for new
`.ugit/workflows/<workflow>/` packages produced by the authored and discovery
`ugit-ci-setup` skill payloads instead of defaulting to `run-ugit-ci.sh`.

#### Scenario: Skill scaffolds a new workflow package
- **WHEN** the `ugit-ci-setup` skill creates or updates a workflow package for
  a named workflow
- **THEN** the scaffold SHALL include `package.json` plus a TypeScript
  workflow entrypoint file
- **AND** the generated `ugit:ci` script SHALL execute that TypeScript
  entrypoint through the approved Node runtime command
- **AND** the TypeScript wrapper SHALL preserve the existing behavior of
  returning to the repository root before it runs the confirmed validation
  command

### Requirement: Local workflow validation guidance preserves the install-before-run contract
README guidance, skill references, materialization docs, and helper smoke
flows SHALL treat
`pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
followed by `pnpm --dir <workflow> run ugit:ci` as the standard local workflow
validation path.

#### Scenario: Human-facing docs describe local validation
- **WHEN** a user reads README guidance, the workflow-contract reference, the
  remote-validation reference, or related materialization docs
- **THEN** each local workflow validation example SHALL show the install step
  before `ugit:ci`
- **AND** the docs SHALL keep that order consistent with the existing local
  runner behavior in `packages/ugit-cli/src/workflow.ts`

#### Scenario: Smoke validation exercises the documented flow
- **WHEN** the ugit CI skill smoke helper scaffolds a temporary workflow
  package
- **THEN** it SHALL run
  `pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
  before `pnpm --dir <workflow> run ugit:ci`
- **AND** the smoke assertion SHALL validate the scaffolded TypeScript
  workflow package through that install-first flow

### Requirement: Skill materialization and parity helpers track the TypeScript template inventory
The repository SHALL keep the authored `skills/ugit-ci-setup` payload, the
repo-local discovery `.codex/skills/ugit-ci-setup` payload, and the
materialize/export/parity helper scripts synchronized around the TypeScript
template filenames and file list.

#### Scenario: Helper scripts materialize or export the skill payload
- **WHEN** `scripts/materialize-ugit-ci-skill.sh` or
  `scripts/export-ugit-ci-skill-patch.sh` enumerates required skill files
- **THEN** the required file list SHALL include the TypeScript workflow
  template assets
- **AND** the helper output SHALL no longer require the deprecated shell
  template filename as the default scaffold artifact

#### Scenario: Skill parity tests validate the discovery payload
- **WHEN** `lib/codex-skills.test.ts` checks authored and discovery skill
  payload parity
- **THEN** it SHALL require the TypeScript template inventory in both
  locations
- **AND** it SHALL fail if either payload still tracks the old shell-template
  filename instead of the approved TypeScript scaffold

### Requirement: Canonical request title metadata remains explicit in artifacts
The materialized OpenSpec artifacts SHALL carry the canonical request title
`ci(workflow/ci): standardize install-first TypeScript CI workflows` and
conventional-title metadata `ci(workflow/ci)` without changing the approved
OpenSpec change path
`workflow-ts-ci-a1-p1-workflow-ci-a1-p1-install-before-run-and-favor-type`.

#### Scenario: Planner materializes the assigned workflow CI change
- **WHEN** planner writes the proposal, design, spec, and tasks for this
  change
- **THEN** the artifacts SHALL reference the canonical request title
  `ci(workflow/ci): standardize install-first TypeScript CI workflows`
- **AND** the slash-delimited roadmap/topic scope SHALL stay in
  conventional-title metadata instead of altering the approved change path
