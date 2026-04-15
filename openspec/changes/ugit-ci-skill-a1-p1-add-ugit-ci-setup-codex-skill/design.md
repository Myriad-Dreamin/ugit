## Context

This change adds the first ugit product-focused repo-local Codex skill to the
repository. The repository already defines the remote CI contract in
`README.md`: every workflow lives under `.ugit/workflows/<workflow>/`, each
workflow directory is an npm package, and each package exposes a `ugit:ci`
script that the remote runner executes with `pnpm --dir <workflow> run
ugit:ci`.

The design must stay narrow. It should guide Codex through repository
inspection, workflow-package scaffolding, prerequisite verification, and
optional remote validation while reusing the existing ugit CLI for repository
setup, manual workflow runs, log streaming, and PR-backed CI. The goal is not
to expand ugit server behavior, replace the CLI, or promise exhaustive
stack-specific templates in the first cut.

## Goals / Non-Goals

**Goals:**
- Add `.codex/skills/ugit-ci-setup/SKILL.md` with a progressive-disclosure
  workflow for inspecting a repository, confirming missing CI inputs, and
  scaffolding `.ugit/workflows/<workflow>/`.
- Provide minimal supporting references or templates so the skill can produce
  a valid workflow package with a `package.json` and a concrete `ugit:ci`
  wrapper around the repository's chosen validation command.
- Verify ugit prerequisites before any remote trigger by checking the local
  repository state, ugit CLI availability, machine configuration, and the
  repository's remote connectivity assumptions.
- Make `ugit workflow run` plus `ugit workflow logs` the default smoke path,
  with `ugit pr create` reserved for users who explicitly want PR-backed CI and
  auto-merge semantics.
- Add concise discoverability documentation that explains the skill's purpose
  and its dependence on the existing ugit CLI contract.

**Non-Goals:**
- Reimplement `ugit create`, `ugit serve`, `ugit workflow run`, `ugit workflow logs`,
  or `ugit pr create`.
- Introduce server-side CI scheduler changes, merge-policy changes, or new
  network protocols.
- Ship a large catalog of stack-specific templates in the first version.
- Guarantee an unattended setup flow when the repository's validation commands
  cannot be inferred reliably.

## Decisions

### Decision: Keep the skill repo-local and documentation-first

The change will add a repo-local `.codex/skills/ugit-ci-setup` skill with only
minimal supporting assets. This matches the repository's current use of
repo-local skills, keeps the first ugit product skill easy to review, and
avoids early packaging or marketplace decisions.

Alternative considered:
- Create a globally installable or marketplace skill. Rejected because the
  request only needs a repo-local workflow and global distribution introduces a
  separate packaging and update problem.

### Decision: Use a progressive-disclosure interaction model

The skill should first inspect the repository for package-manager scripts,
common test or lint entrypoints, existing CI files, and any existing `.ugit`
workflow packages. It should only ask follow-up questions when command
inference is ambiguous or when a user choice materially affects the generated
workflow.

Alternative considered:
- Use a fixed questionnaire before any inspection. Rejected because it adds
  avoidable friction and ignores strong repository signals that Codex can
  gather automatically.

### Decision: Scaffold a generic npm package around the repository's CI command

The workflow contract is npm-package-based even when the target repository uses
other tooling. The first cut should therefore generate a `.ugit/workflows/<workflow>/`
package with a `package.json` plus the smallest wrapper files needed to invoke
the chosen repository validation command consistently from `ugit:ci`.

Alternative considered:
- Ship framework-specific templates for each common stack. Rejected for the
  initial cut because inference plus a generic wrapper reaches more repositories
  with less maintenance.

### Decision: Verify prerequisites before remote execution

Before offering remote validation, the skill should check that `ugit` is
installed, the repository can resolve its configured ugit machine, the local
repository appears connected to a ugit remote, and the workflow package shape
matches the documented contract. When prerequisites fail, the skill should
provide concise remediation steps and point users back to the existing CLI
commands rather than emulating them.

Alternative considered:
- Attempt remote execution first and rely on ugit failures for feedback.
  Rejected because setup errors would be slower to diagnose and harder for the
  user to correct.

### Decision: Default to manual workflow runs for smoke validation

The default verification path should be `ugit workflow run <workflow>` followed
by `ugit workflow logs <workflowId>`. This exercises the remote workflow
package directly without creating or mutating a pull request. `ugit pr create`
remains available only when the user explicitly asks for PR-backed CI or
auto-merge semantics.

Alternative considered:
- Always validate through pull-request creation. Rejected because it couples
  setup verification to branch publication and merge behavior that many users
  do not want during initial CI scaffolding.

## Risks / Trade-offs

- [Inference picks the wrong validation command] -> Require user confirmation
  when repository signals are weak and prefer explicit commands over silent
  guesses.
- [Repositories without Node tooling still need npm workflow packages] -> Use a
  thin wrapper package that can shell out to non-Node commands instead of
  assuming the target repository itself is npm-based.
- [Prerequisite checks vary across repository setups] -> Keep checks focused on
  the documented ugit contract and emit remediation steps that rely on existing
  CLI commands.
- [Remote smoke runs may be unsafe in some worktrees] -> Make remote execution
  optional and only trigger it when the current repository and machine setup
  are safe to use.

## Migration Plan

1. Add the repo-local skill, its references or templates, and any minimal
   helper assets needed for scaffolding.
2. Document how to invoke the skill and how it maps onto the existing ugit CLI
   workflow.
3. Verify the skill locally by scaffolding a workflow package in a safe target
   repository and, when connectivity is available, running one manual
   `ugit workflow run` plus `ugit workflow logs` smoke pass.

Rollback is straightforward because the feature is additive: removing the skill
directory and its supporting docs returns the repository to the current manual
workflow.

## Open Questions

- Should the first version emit a placeholder `ugit:ci` command when no
  reliable validation command can be inferred, or should it stop until the user
  supplies an explicit command?
