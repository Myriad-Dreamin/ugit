## ADDED Requirements

### Requirement: `ugit create` requires an explicit remote repository name
The `ugit create` command SHALL require callers to provide the remote
repository name explicitly with `--name <remote-repo-name>`, while keeping the
existing optional `[directory]` positional for selecting the local repository
root.

#### Scenario: Missing `--name` is rejected before create side effects
- **WHEN** a caller runs `ugit create -m <machine> [directory]` without
  `--name <remote-repo-name>`
- **THEN** the command SHALL fail before creating a remote repository or
  mutating the local `origin`
- **AND** it SHALL instruct the caller to provide the required explicit remote
  repository name

#### Scenario: Explicit remote name stays distinct from optional local directory
- **WHEN** a caller runs
  `ugit create -m <machine> --name canonical-repo ../local-copy`
- **THEN** `../local-copy` SHALL remain the local repository target used for
  repository-root and `upstream` checks
- **AND** `canonical-repo` SHALL be the remote repository identity used for the
  ugit create flow

### Requirement: Remote repository names are validated as one safe path segment
The system SHALL accept only remote repository names that are a single safe
path segment. A valid name MUST be non-empty, MUST NOT be `.` or `..`, and
MUST NOT contain path separators. Otherwise valid names, including names with
spaces, SHALL remain supported.

#### Scenario: Empty, traversal, or nested names are rejected
- **WHEN** a caller supplies an empty name, `.`, `..`, `team/repo`, or
  `team\\repo` through `--name`
- **THEN** the command SHALL fail before remote setup and before any local
  origin or machine-config mutation
- **AND** the error SHALL explain that the remote repository name must be one
  safe path segment

#### Scenario: Valid names with spaces remain supported
- **WHEN** a caller supplies `--name "team repo"` and the rest of the create
  preconditions succeed
- **THEN** the remote repository path and origin URL SHALL use `team repo` as
  the repository name
- **AND** any rendered shell commands or recovery guidance SHALL keep quoting
  safe for that name

### Requirement: The provided remote name drives remote path, URL, and origin-conflict targeting
`ugit create` SHALL use the provided remote repository name for remote
repository path generation, origin URL computation, origin-conflict inspection,
success output, and local recovery messaging instead of deriving those values
from the local repository basename.

#### Scenario: Local checkout basename no longer determines the remote repository
- **WHEN** a local repository rooted at `/work/local-copy` runs
  `ugit create -m <machine> --name canonical-repo`
- **THEN** the remote repository path SHALL end in `canonical-repo`
- **AND** the configured local `origin` SHALL point at the ugit URL for
  `canonical-repo`
- **AND** the success output SHALL report the created ugit repository as
  `canonical-repo`

#### Scenario: Origin-conflict handling references the explicit remote name
- **WHEN** a local repository already has a conflicting `origin` and the caller
  runs `ugit create -m <machine> --name canonical-repo`
- **THEN** the prompt, non-interactive error, and approved replacement path
  SHALL reference the computed ugit URL for `canonical-repo`
- **AND** the create flow SHALL not fall back to the local repository basename
  while resolving that conflict

### Requirement: Documentation and regressions cover the explicit-name create contract
The repository SHALL document the required `--name` option, safe-name
validation, and unchanged `--override-origin` behavior for `ugit create`, and
SHALL add focused Vitest coverage for the explicit-name flow.

#### Scenario: Help text and README describe the new synopsis
- **WHEN** a contributor or user consults `ugit create --help` or `README.md`
- **THEN** the documentation SHALL show
  `ugit create -m <machine> --name <remote-repo-name> [--override-origin] [directory]`
- **AND** it SHALL explain that `--name` selects the remote repository identity
  while `[directory]` still selects the local repository root

#### Scenario: Vitest coverage pins explicit-name behavior
- **WHEN** the CLI test suite exercises `ugit create`
- **THEN** it SHALL cover required-name parsing, invalid names, explicit-name
  remote path or URL computation, and origin-conflict handling with the
  provided name
- **AND** it SHALL verify that valid single-segment names with spaces remain
  supported

### Requirement: Materialized artifacts preserve canonical create-command metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`fix(cli/create): require remote repository name` and conventional-title
metadata `fix(cli/create)` without altering the approved change path
`create-remote-name-a1-p1-require-explicit-remote-repository-name-for-ugi`.

#### Scenario: Planner materializes the assigned create-name change
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `fix(cli/create): require remote repository name`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
