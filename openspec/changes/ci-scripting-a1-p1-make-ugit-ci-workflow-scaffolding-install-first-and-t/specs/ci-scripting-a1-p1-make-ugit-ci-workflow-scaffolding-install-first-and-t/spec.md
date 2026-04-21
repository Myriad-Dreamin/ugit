## ADDED Requirements

### Requirement: ugit CI scaffolding defaults to a TypeScript entrypoint that assumes install-before-run
The system SHALL author the `ugit-ci-setup` skill and its templates so newly
scaffolded `.ugit/workflows/<workflow>/` packages recommend a TypeScript-based
entrypoint and depend on the existing install-before-run runner contract rather
than a checked-in shell wrapper.

#### Scenario: Workflow package scaffold uses a TypeScript entrypoint
- **WHEN** the skill scaffolds or refreshes a workflow package from the
  committed templates
- **THEN** the resulting workflow package SHALL include `package.json`
- **AND** the `ugit:ci` script SHALL invoke a TypeScript entrypoint such as
  `run-ugit-ci.ts`
- **AND** the scaffold SHALL include the minimal workflow-local metadata or
  dependencies required for that entrypoint to run after `pnpm install`

#### Scenario: Local guidance installs before `ugit:ci`
- **WHEN** the skill or repository docs describe local verification of the
  generated workflow package
- **THEN** they SHALL instruct users to install workflow-package dependencies
  before invoking `ugit:ci`
- **AND** that guidance SHALL match the runner contract
  `pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
  followed by `pnpm --dir <workflow> run ugit:ci`

### Requirement: Workflow execution stays generic and install-first
The system SHALL keep the ugit workflow runner contract generic for execution:
workflow packages remain valid with only `package.json` plus a `ugit:ci`
script, and both CLI-local and server-side execution SHALL install
dependencies before running the script.

#### Scenario: Existing workflow packages remain valid
- **WHEN** a workflow package defines `package.json` and a `ugit:ci` script but
  does not use the new TypeScript scaffold
- **THEN** the CLI and server runner SHALL continue to accept that workflow
  package
- **AND** they SHALL not require extra workflow files or server-side metadata

#### Scenario: Execution still installs before running
- **WHEN** the CLI or server runner executes a valid workflow package
- **THEN** it SHALL run
  `pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
  before `pnpm --dir <workflow> run ugit:ci`
- **AND** install failures and `ugit:ci` failures SHALL remain distinct
  actionable failure modes

### Requirement: Skill materialization and smoke proofs stay aligned with the authored payload
The system SHALL keep the authored `skills/ugit-ci-setup` payload, repo-local
discovery copy, and proof helpers aligned around the install-first
TypeScript-first scaffold.

#### Scenario: Materialization and parity checks track the full payload
- **WHEN** the skill payload is materialized, exported as a patch, or checked
  for discovery parity
- **THEN** the helper scripts and parity tests SHALL include every authored
  file required by the recommended TypeScript-first scaffold and its supporting
  docs
- **AND** the discovery payload SHALL match the authored
  `skills/ugit-ci-setup` contents byte-for-byte

#### Scenario: Smoke proof exercises install-then-run
- **WHEN** `./scripts/smoke-ugit-ci-skill.sh` scaffolds a temporary workflow
  package from the committed templates
- **THEN** it SHALL install workflow-package dependencies before invoking
  `ugit:ci`
- **AND** the smoke exercise SHALL prove that the generated TypeScript
  entrypoint runs successfully from the temporary workflow directory

### Requirement: Documentation recommends TypeScript-first install-before-run workflows
The system SHALL document the ugit CI setup skill and workflow contract so
local smoke guidance matches the runner and the recommended scaffold is
TypeScript-first.

#### Scenario: README and skill docs explain the contract
- **WHEN** a user reads `README.md`, `skills/ugit-ci-setup/SKILL.md`, or
  `skills/ugit-ci-setup/references/workflow-contract.md`
- **THEN** the docs SHALL describe ugit-managed workflow execution as
  install-before-run
- **AND** they SHALL recommend TypeScript-based workflow logic for
  maintainability and cross-platform behavior

#### Scenario: Remote validation guidance keeps existing ugit commands
- **WHEN** the docs explain optional remote validation for the generated
  workflow package
- **THEN** they SHALL continue pointing users to
  `ugit workflow run <workflow>` and `ugit workflow logs <workflowId>`
- **AND** they SHALL not add new server-side workflow shape requirements beyond
  the documented contract

### Requirement: Materialized artifacts preserve canonical CI scaffolding metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`ci(ugit/ci-setup): adopt install-first TypeScript CI scaffolding` and
conventional-title metadata `ci(ugit/ci-setup)` without altering the approved
change path
`ci-scripting-a1-p1-make-ugit-ci-workflow-scaffolding-install-first-and-t`.

#### Scenario: Planner materializes the assigned CI scaffolding change
- **WHEN** planner writes the proposal, design, spec, and tasks for this
  change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `ci(ugit/ci-setup): adopt install-first TypeScript CI scaffolding`
- **AND** the slash-delimited scope SHALL remain metadata instead of changing
  the approved OpenSpec change path
