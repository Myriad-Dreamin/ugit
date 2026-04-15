# ugit-ci-skill-a1-p1-add-ugit-ci-setup-codex-skill Specification

## Purpose
Define the repo-local Codex skill that inspects repositories, scaffolds
`.ugit/workflows/<workflow>/` packages, verifies ugit prerequisites, and uses
the existing ugit CLI for optional remote validation.
## Requirements
### Requirement: Repo-local ugit CI setup skill exists
The repository SHALL provide a repo-local `.codex/skills/ugit-ci-setup`
skill that guides Codex through setting up ugit CI for a target repository
without replacing the existing ugit CLI.

#### Scenario: User requests ugit CI setup
- **WHEN** a user asks Codex to set up ugit CI for a repository in a checkout
  that contains the skill
- **THEN** Codex SHALL use the repo-local `ugit-ci-setup` skill
- **AND** the skill SHALL explain that it scaffolds workflow packages and
  relies on the existing ugit CLI for repository and remote CI operations

### Requirement: Skill inspects the repository before asking questions
The skill SHALL inspect the target repository for workflow-relevant signals,
including existing `.ugit` files, package-manager scripts, and likely
validation commands, before asking the user for missing CI inputs.

#### Scenario: Repository signals are sufficient
- **WHEN** the target repository already exposes an obvious validation command
  such as an existing test, lint, or build script
- **THEN** the skill SHALL propose that command for the generated workflow
- **AND** the skill SHALL avoid asking additional setup questions unless a
  decision remains ambiguous

#### Scenario: Repository signals are ambiguous
- **WHEN** the skill cannot infer a reliable validation command or workflow
  name from repository inspection
- **THEN** the skill SHALL ask only the missing high-signal questions needed to
  scaffold the workflow package correctly

### Requirement: Skill scaffolds a workflow package that matches the ugit contract
The skill SHALL create or update `.ugit/workflows/<workflow>/` as an npm
package that satisfies the documented ugit workflow contract.

#### Scenario: New workflow package is scaffolded
- **WHEN** the user confirms the workflow name and validation command
- **THEN** the skill SHALL create or update `.ugit/workflows/<workflow>/`
- **AND** the workflow directory SHALL contain a `package.json`
- **AND** the generated package SHALL expose a `ugit:ci` script that executes
  the chosen repository validation command

### Requirement: Skill verifies ugit prerequisites before remote validation
The skill SHALL check local ugit prerequisites before offering or attempting
remote workflow execution.

#### Scenario: Prerequisites are satisfied
- **WHEN** `ugit` is available, machine configuration is resolvable, the
  repository appears connected to ugit, and the workflow package matches the
  documented contract
- **THEN** the skill SHALL report that remote validation is available

#### Scenario: Prerequisites fail
- **WHEN** any ugit prerequisite needed for remote validation is missing or
  inconsistent
- **THEN** the skill SHALL stop short of remote execution
- **AND** the skill SHALL provide concise remediation that points to the
  existing ugit commands or repository setup the user must complete

### Requirement: Manual workflow runs are the default remote smoke path
The skill SHALL prefer manual workflow runs over PR creation for initial remote
validation.

#### Scenario: User wants a remote smoke test
- **WHEN** the user asks the skill to validate the generated workflow remotely
  without asking for a pull request
- **THEN** the skill SHALL use `ugit workflow run <workflow>` as the default
  trigger path
- **AND** the skill SHALL follow that run with `ugit workflow logs <workflowId>`
  so the user can observe the remote result

#### Scenario: User explicitly requests PR-backed CI
- **WHEN** the user explicitly asks for PR-backed CI or auto-merge semantics
- **THEN** the skill SHALL offer `ugit pr create` as the trigger path instead
  of treating it as the default validation flow

### Requirement: Canonical request title metadata remains explicit in artifacts
The materialized OpenSpec artifacts SHALL carry the canonical request title
`feat(codex/ci): Add ugit CI setup skill` and conventional-title metadata
`feat(codex/ci)` without changing the approved OpenSpec change path.

#### Scenario: Planner materializes the proposal
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** the artifacts SHALL reference the canonical request title
  `feat(codex/ci): Add ugit CI setup skill`
- **AND** the conventional-title metadata SHALL stay explicit metadata rather
  than altering the change path
  `ugit-ci-skill-a1-p1-add-ugit-ci-setup-codex-skill`
