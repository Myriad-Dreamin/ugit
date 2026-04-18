# origin-override-a1-p1-prompt-before-overriding-origin-remote-during-ugit Specification

## Purpose
Define how `ugit create` handles conflicting local `origin` remotes by
prompting interactive users before replacement and requiring an explicit
override path for deterministic non-interactive runs.
## Requirements
### Requirement: `ugit create` prompts before replacing a conflicting local `origin`
The `ugit create -m <machine> [directory]` command SHALL detect when the local
repository already has an `origin` remote that differs from the computed ugit
URL and SHALL ask for confirmation before replacing that local `origin` during
interactive use.

#### Scenario: Interactive user approves origin replacement
- **WHEN** `ugit create -m <machine> [directory]` runs in an interactive terminal
  and the local repository's existing `origin` differs from the computed ugit
  URL
- **THEN** the command SHALL prompt the user to confirm replacing `origin`
- **AND** an approved prompt response SHALL allow the create flow to continue
- **AND** the local repository's `origin` SHALL be updated to the computed ugit
  URL

#### Scenario: Interactive user declines origin replacement
- **WHEN** `ugit create -m <machine> [directory]` runs in an interactive terminal
  and the user declines the conflicting `origin` replacement prompt
- **THEN** the command SHALL abort cleanly
- **AND** it SHALL not initialize or modify the ugit remote repository
- **AND** it SHALL not replace the local repository's `origin` URL

### Requirement: Non-interactive origin replacement stays explicit
The system SHALL keep non-interactive `ugit create` runs deterministic by
requiring an explicit override option before replacing a conflicting local
`origin` remote.

#### Scenario: Non-interactive run uses explicit override
- **WHEN** `ugit create -m <machine> --override-origin [directory]` runs without
  an interactive terminal and the local repository's existing `origin` differs
  from the computed ugit URL
- **THEN** the command SHALL skip prompting
- **AND** it SHALL continue creating the ugit repository
- **AND** it SHALL replace the local repository's `origin` URL with the
  computed ugit URL

#### Scenario: Non-interactive run omits explicit override
- **WHEN** `ugit create -m <machine> [directory]` runs without an interactive
  terminal and the local repository's existing `origin` differs from the
  computed ugit URL
- **THEN** the command SHALL fail with actionable guidance to rerun with the
  explicit override option
- **AND** it SHALL not prompt for input
- **AND** it SHALL not initialize or modify the ugit remote repository
- **AND** it SHALL not replace the local repository's `origin` URL

### Requirement: Approved origin replacement only changes the local origin step
The system SHALL preserve existing `ugit create` behavior for remote repository
initialization, `upstream` requirements, unknown machines, existing remote repo
paths, and already-correct `origin` remotes while updating the local `origin`
with `git remote set-url origin <originUrl>` when replacement is approved.

#### Scenario: Approved replacement updates the local origin after remote setup
- **WHEN** a conflicting local `origin` has been explicitly approved for
  replacement
- **THEN** `ugit create` SHALL keep the existing remote-repository initialization
  flow
- **AND** it SHALL update the local repository with
  `git remote set-url origin <computed-origin-url>` instead of requiring manual
  intervention

#### Scenario: Existing matching origin keeps current behavior
- **WHEN** the local repository already has an `origin` remote that matches the
  computed ugit URL
- **THEN** `ugit create` SHALL not prompt for origin replacement
- **AND** it SHALL continue with the rest of the current create flow

### Requirement: Documentation and regressions cover the new origin-override contract
The repository SHALL document the conflicting-origin prompt and explicit
override path for `ugit create`, and SHALL add focused Vitest coverage for the
approved, declined, and non-interactive conflict paths.

#### Scenario: CLI help and README document prompt and override flag
- **WHEN** a contributor or user consults `ugit create` help output or `README.md`
- **THEN** the documentation SHALL explain when the origin-replacement prompt
  appears
- **AND** it SHALL explain how to bypass the prompt in scripts with the explicit
  override option

#### Scenario: Vitest coverage pins conflict resolution behavior
- **WHEN** the CLI test suite exercises `ugit create` origin-conflict handling
- **THEN** it SHALL cover interactive accept, interactive decline, explicit
  override, and non-interactive refusal behavior
- **AND** it SHALL verify that approved replacement updates the local `origin`
  to the computed ugit URL

### Requirement: Materialized artifacts preserve canonical create-command metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`fix(cli/create): prompt before overriding origin remote` and
conventional-title metadata `fix(cli/create)` without altering the approved
change path
`origin-override-a1-p1-prompt-before-overriding-origin-remote-during-ugit`.

#### Scenario: Planner materializes the assigned origin-override change
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `fix(cli/create): prompt before overriding origin remote`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
