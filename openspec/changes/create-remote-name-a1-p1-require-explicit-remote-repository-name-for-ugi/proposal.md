## Why

`ugit create` currently derives the remote repository identity from the local
directory basename. That makes the remote target ambiguous when a checkout name
is only a local convenience, and it turns unsanitized user-controlled path
segments into server paths once callers need to choose a different remote name.

This change makes the remote repository name explicit and validated at the CLI
contract boundary. It keeps the create flow focused on one breaking change:
callers must choose the remote repository name up front instead of inheriting it
from the local checkout path.

## What Changes

- **BREAKING** Require `ugit create` callers to pass an explicit remote
  repository name, preferably as `--name <remote-repo-name>`, while keeping the
  existing optional `[directory]` positional for selecting the local repository
  root.
- Remove the basename fallback from the create-library contract and thread the
  provided remote name through origin-conflict inspection, remote repository
  path and URL generation, success output, and local recovery messaging.
- Validate the supplied remote name as one safe repository path segment: it
  must be non-empty, must not be `.` or `..`, and must not contain path
  separators. Otherwise valid names, including names with spaces, remain
  supported.
- Update `README.md`, `ugit create --help`, and the new OpenSpec wording so the
  command synopsis, examples, and behavior descriptions all reflect the
  explicit-name contract.
- Add focused Vitest coverage for required-name parsing, invalid names,
  explicit-name path and URL computation, and origin-conflict handling with the
  provided name.

## Capabilities

### New Capabilities

- `create-remote-name-a1-p1-require-explicit-remote-repository-name-for-ugi`:
  Define the explicit remote repository naming contract for `ugit create`,
  including safe-name validation, explicit origin-conflict targeting, updated
  documentation, and regression coverage.

### Modified Capabilities

- None.

## Conventional Title

- Canonical request/PR title: `fix(cli/create): require remote repository name`
- Conventional title metadata: `fix(cli/create)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Proposal title: Require explicit remote repository name for `ugit create`
- Planner summary: Require `ugit create` callers to pass an explicit remote
  repository name instead of deriving the remote repository path from the local
  directory basename.
- Affected code areas: `packages/ugit-cli/src/commands/create.ts`,
  `packages/ugit-cli/src/create.ts`, `packages/ugit-cli/src/commands/create.test.ts`,
  `packages/ugit-cli/src/create.test.ts`, and `README.md`
- Validation contract after implementation: `pnpm fmt`, `pnpm fmt:check`,
  `pnpm lint`, `pnpm test`, and `pnpm build`
- Scope boundaries: no PR or workflow API changes, no repository rename or
  migration flow, and no fallback back to the local checkout name once this
  change lands
- Key assumptions and risks:
  - This is an intentional breaking CLI change for existing
    `ugit create -m <machine> [directory]` invocations, so docs and help text
    must make the new requirement obvious.
  - Validation must block path traversal and nested remote repository paths
    because the remote name now comes directly from user input.
  - A required `--name` option is the clearest contract because adding a second
    positional argument would overload the existing optional `[directory]`
    parameter.
