## Why

The repository already documents the ugit workflow contract and exposes
`ugit create`, `ugit serve`, `ugit pr create`, `ugit workflow run`, and
`ugit workflow logs`, but setting up `.ugit/workflows/<workflow>/` packages is
still a manual, error-prone process. A repo-local Codex skill can turn that
documented contract into a guided setup flow that scaffolds the workflow
package, verifies ugit prerequisites, and optionally triggers remote
validation without inventing new transport or CI behavior.

## What Changes

- Add a repo-local `.codex/skills/ugit-ci-setup` skill that inspects a target
  repository, infers likely validation commands, and asks only the missing
  high-signal questions before scaffolding CI.
- Add minimal references or template assets that help the skill generate
  `.ugit/workflows/<workflow>/` packages with a `package.json` and a
  `ugit:ci` entry that wraps the repository's chosen validation command.
- Define a prerequisite verification flow that checks ugit CLI availability,
  machine and repository connectivity, and workflow package shape before remote
  validation is attempted.
- Make manual workflow runs the default remote verification path through
  `ugit workflow run` followed by `ugit workflow logs`, while keeping
  `ugit pr create` as an explicit opt-in path for PR-backed CI and merge
  semantics.
- Add light repository documentation so humans can discover the skill and
  understand that it builds on the existing ugit CLI instead of replacing it.

## Capabilities

### New Capabilities
- `ugit-ci-skill-a1-p1-add-ugit-ci-setup-codex-skill`: Introduce a repo-local
  Codex skill that scaffolds ugit workflow packages, verifies ugit
  prerequisites, and optionally triggers remote validation through the
  existing ugit CLI.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `feat(codex/ci): Add ugit CI setup skill`
- Conventional title metadata: `feat(codex/ci)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter the OpenSpec change path
  `ugit-ci-skill-a1-p1-add-ugit-ci-setup-codex-skill`.

## Impact

- Affected areas: `.codex/skills`, skill reference or template assets, and
  light repository documentation for skill discovery.
- Existing interfaces reused: the documented workflow contract under
  `.ugit/workflows/<workflow>/` plus the current `ugit create`, `ugit serve`,
  `ugit workflow run`, `ugit workflow logs`, and `ugit pr create` commands.
- Validation expectation: `pnpm fmt`, `pnpm fmt:check`, and a concrete skill
  smoke exercise that scaffolds a workflow and, when a safe target exists,
  queues a remote run through `ugit workflow run`.
