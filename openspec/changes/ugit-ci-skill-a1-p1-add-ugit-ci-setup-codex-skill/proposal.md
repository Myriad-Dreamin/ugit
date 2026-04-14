## Why

Repositories currently need manual knowledge of ugit's workflow-package
contract, machine prerequisites, and pull-request synchronization flow to
adopt remote CI. A repo-local Codex skill can package that knowledge into one
guided workflow so users can scaffold `.ugit/workflows/<workflow>/` safely and
trigger remote CI without inventing new server behavior.

## What Changes

- Introduce the `ugit-ci-skill-a1-p1-add-ugit-ci-setup-codex-skill` OpenSpec
  change for proposal "Add ugit CI setup Codex skill".
- Add one repo-local `.codex/skills/ugit-ci-setup/` skill that inspects the
  target repository, verifies ugit prerequisites or points users to
  `ugit create`, and asks for the repository's real validation commands before
  scaffolding CI files.
- Add only the targeted references and optional minimal reusable assets needed
  to create `.ugit/workflows/<workflow>/` packages with a valid `package.json`
  and `ugit:ci` script.
- Update discoverability docs so repository users know how to invoke the skill,
  what it scaffolds, and that remote CI queueing stays on the existing
  `ugit pr sync` path.
- Keep the current server-side workflow contract unchanged, including
  `.ugit/workflows/<workflow>/` package layout and
  `.data/ci-results/<repo>/<branch>.json` result artifacts.

## Capabilities

### New Capabilities

- `ugit-ci-skill-a1-p1-add-ugit-ci-setup-codex-skill`: Materialize the
  approved CI-setup-skill proposal by adding one repo-local Codex skill that
  verifies ugit prerequisites, scaffolds `.ugit/workflows/<workflow>/`
  packages, and offers to queue remote CI through `ugit pr sync`.

### Modified Capabilities

- None.

## Conventional Title

- Proposal title: `Add ugit CI setup Codex skill`
- Canonical request/PR title: `feat(ci/skill): introduce ugit ci setup skill`
- Conventional title metadata: `feat(ci/skill)`
- The assignment also references `feat(ci/skill): Add ugit CI setup Codex skill`;
  preserve the explicit canonical request title above while keeping the
  proposal title human-readable.

## Impact

- Affected areas: `.codex/skills`, discoverability documentation, and optional
  template or helper-test files if implementation needs reusable scaffolding.
- Existing ugit systems reused: `ugit create`, `ugit serve`, `ugit pr sync`,
  the `.ugit/workflows/<workflow>/` runner contract, and
  `.data/ci-results/<repo>/<branch>.json`.
- Validation expectations: `pnpm fmt` and `pnpm fmt:check` for the markdown
  deliverables, plus `pnpm lint` and targeted tests if helper code or scripts
  are introduced during implementation.
- Key approval risks: `ugit pr sync` can participate in auto-merge on green CI,
  and command detection across arbitrary repositories must stay guided instead
  of fully automatic.
