## ADDED Requirements

### Requirement: Server-side gh lookup preserves canonical PR metadata and GitHub delegation behavior
The system SHALL resolve canonical GitHub pull-request metadata on the server
through the installed `gh` CLI while preserving existing GitHub remote
discovery and compare-link delegation behavior. Lookup SHALL remain independent
from the current working directory by targeting the discovered repository
coordinates explicitly.

#### Scenario: Canonical PR lookup returns the current metadata shape through gh
- **WHEN** ugit evaluates a pull request whose repository GitHub remote resolves
  to owner or repository coordinates and a matching canonical GitHub pull
  request exists for the branch and base
- **THEN** the server-side lookup SHALL return the pull request number, URL,
  head branch, head commit hash, base branch, base commit hash, and mergeable
  state for that canonical pull request
- **AND** the repo-scoped detail model SHALL keep using the canonical pull
  request URL for GitHub delegation

#### Scenario: Missing canonical PR metadata falls back without breaking GitHub delegation
- **WHEN** ugit can resolve GitHub remote metadata for a repository but `gh`
  does not return a matching canonical pull request for the branch and base
- **THEN** canonical pull-request metadata SHALL remain unavailable for
  readiness and merge execution
- **AND** the repo-scoped detail model SHALL still surface the existing
  best-effort GitHub compare delegation derived from repository remote data

### Requirement: Approved merges stay squash-only and head-guarded through gh-mediated execution
The system SHALL execute approved GitHub merges through `gh`-mediated command
execution while preserving current manual-merge semantics: squash-only merge
behavior, expected head-SHA guarding, fail-closed handling for GitHub
rejections, and mirrored-base realignment after a successful merge.

#### Scenario: Approved merge succeeds through gh and realigns the mirrored base branch
- **WHEN** a pull request is ready to merge and the server executes the
  approved GitHub merge for the current canonical pull-request head commit
- **THEN** the system SHALL perform a squash merge for that canonical pull
  request through the `gh`-backed server adapter
- **AND** it SHALL fetch the selected GitHub base branch and update the
  mirrored local base branch to the fetched GitHub base commit
- **AND** it SHALL persist the pull request as `merged`

#### Scenario: Head drift or GitHub merge rejection fails closed
- **WHEN** the canonical pull-request head commit no longer matches the
  approved commit, or GitHub rejects the squash merge because the pull request
  is no longer mergeable
- **THEN** the merge request SHALL fail closed without mutating the mirrored
  local base branch
- **AND** the repo-scoped merge response SHALL return a not-ready or blocked
  outcome with actionable guidance

### Requirement: gh installation and authentication failures block readiness with actionable operator guidance
The system SHALL treat missing `gh`, failed `gh` authentication, malformed
`gh` JSON output, and command-start failures as blocked readiness or merge
states rather than guessing. Operator guidance SHALL move from
`UGIT_GITHUB_TOKEN` setup to `gh auth login` and `gh auth status`.

#### Scenario: Missing gh or failed auth blocks readiness and merge
- **WHEN** the ugit server cannot start `gh` or `gh` cannot authenticate for
  the target GitHub repository
- **THEN** the pull request SHALL remain not ready to merge
- **AND** repo-scoped detail reads and merge responses SHALL instruct the
  operator to install `gh` or run `gh auth login` and verify `gh auth status`

#### Scenario: Malformed gh output keeps readiness blocked
- **WHEN** the server receives malformed or incomplete JSON from the `gh`
  command path while reading canonical pull-request metadata
- **THEN** the pull request SHALL remain blocked for merge readiness
- **AND** the repo-scoped response SHALL surface a clear unavailable message
  instead of treating the pull request as mergeable

### Requirement: Browser pull-request flows remain repo-scoped while gh access stays server-only
The system SHALL keep GitHub lookup and merge execution on the server while
repository pull-request detail pages continue to read and write through
repo-scoped same-origin REST endpoints without direct browser GitHub calls.

#### Scenario: Repository PR detail page surfaces gh-backed readiness through repo-scoped REST
- **WHEN** a user opens `/${user}/${repo}/pull-requests/[pullRequestId]`
- **THEN** the page SHALL load readiness, blocking reasons, and merge outcomes
  through the existing repo-scoped REST detail and merge endpoints
- **AND** the browser SHALL not need direct GitHub credentials or direct
  imports of backend GitHub services

### Requirement: Regression coverage and docs reflect the gh CLI operator model
The system SHALL update focused regression coverage and `README.md` guidance so
the manual merge flow documents `gh` setup and protects the new command-based
failure modes.

#### Scenario: Tests and docs cover gh-backed merge transport
- **WHEN** implementation lands for the gh CLI transport swap
- **THEN** Vitest coverage SHALL verify canonical lookup success, missing PR
  metadata, missing `gh`, failed auth, malformed JSON, merge conflict or head
  mismatch, and command-start failure handling
- **AND** `README.md` SHALL describe `gh auth login`, `gh auth status`, and the
  validation commands `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`,
  and `pnpm build`

### Requirement: Materialized artifacts preserve canonical GitHub merge metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`refactor(github/merge): switch GitHub merge adapter to gh` and
conventional-title metadata `refactor(github/merge)` without altering the
approved change path
`gh-cli-a1-p1-replace-server-side-github-rest-integration-with-gh-cli`.

#### Scenario: Planner materializes the assigned gh-cli change
- **WHEN** planner writes the proposal, design, spec, and tasks for this
  change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `refactor(github/merge): switch GitHub merge adapter to gh`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
