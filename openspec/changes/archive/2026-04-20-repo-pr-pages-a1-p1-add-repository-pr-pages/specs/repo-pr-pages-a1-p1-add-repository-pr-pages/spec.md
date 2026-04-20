## ADDED Requirements

### Requirement: Repository pull-request list page bootstraps through repo-scoped REST reads
The system SHALL serve `/${user}/${repo}/pull-requests` for the configured
owner and a discovered repository, and that page SHALL load pull-request
summaries through a repo-scoped same-origin REST read instead of importing
backend pull-request services directly.

#### Scenario: Valid repository pull-request route bootstraps through the list API
- **WHEN** a browser requests `/${user}/${repo}/pull-requests` for the
  configured owner and an existing repository
- **THEN** the system SHALL validate the owner and repository before loading
  pull-request data
- **AND** the initial read SHALL go through
  `GET /api/pull-requests?repositoryName=<repo>`
- **AND** each rendered pull-request summary SHALL link to
  `/${user}/${repo}/pull-requests/[pullRequestId]`

#### Scenario: Unknown owner or repository is rejected before the bootstrap read
- **WHEN** a browser requests `/${user}/${repo}/pull-requests` for an
  unsupported owner or a repository that is not present under the configured
  repositories root
- **THEN** the system SHALL return not found
- **AND** it SHALL not invoke backend pull-request storage reads for the page
  bootstrap

#### Scenario: Active pull-request summaries keep refreshing without a full page reload
- **WHEN** a user keeps `/${user}/${repo}/pull-requests` open while one of
  that repository's latest pull-request jobs remains `queued` or `running`
- **THEN** the browser SHALL continue refreshing pull-request summaries through
  `GET /api/pull-requests?repositoryName=<repo>`
- **AND** polling SHALL stop once the repository has no active latest
  pull-request jobs

### Requirement: Repository pull-request detail page shows repo-owned metadata, activity, CI history, and GitHub delegation
The system SHALL serve `/${user}/${repo}/pull-requests/[pullRequestId]` for
pull requests that belong to the requested repository and SHALL render current
pull-request metadata, activity, CI job history, workflow execution summaries,
and a delegated GitHub card with an `Open on GitHub` action.

#### Scenario: Repo-owned pull-request detail renders timeline and CI/workflow history
- **WHEN** a browser requests
  `/${user}/${repo}/pull-requests/[pullRequestId]` for a pull request whose
  stored repository matches the requested repository
- **THEN** the page SHALL render the pull request's title, branches,
  draft/state metadata, and latest job status
- **AND** the page SHALL include ordered activity entries for the pull request
- **AND** the page SHALL include every recorded CI job for that pull request
  plus per-workflow execution summaries parsed from any available CI result
  artifact

#### Scenario: Cross-repository or missing pull-request ids do not leak data
- **WHEN** a browser requests
  `/${user}/${repo}/pull-requests/[pullRequestId]` and that pull-request id is
  missing or belongs to a different repository
- **THEN** the system SHALL return not found instead of exposing pull-request
  metadata, activity, or CI history

#### Scenario: Active pull-request detail keeps status current through the detail API
- **WHEN** a user views `/${user}/${repo}/pull-requests/[pullRequestId]` while
  the pull request still has a `queued` or `running` latest CI job
- **THEN** the browser SHALL continue polling the repo-scoped pull-request
  detail API without a full page reload
- **AND** the rendered metadata, activity timeline, and CI/workflow history
  SHALL stay current

### Requirement: Pull-request read APIs are repo-scoped, browser-safe, and preserve CLI list/edit behavior
The system SHALL expose repo-scoped browser read contracts keyed by
`repositoryName` and `pullRequestId` while preserving the existing
repository-path list and edit behavior for CLI callers.

#### Scenario: Repository pull-request list API omits raw repository paths from browser responses
- **WHEN** a client requests
  `GET /api/pull-requests?repositoryName=alpha`
- **THEN** the system SHALL resolve repository ownership on the server from
  `repositoryName`
- **AND** the response SHALL include browser-safe pull-request summaries
  without raw `repositoryPath` fields

#### Scenario: Repository pull-request detail API rejects repository mismatches
- **WHEN** a client requests
  `GET /api/pull-requests/17?repositoryName=beta` for a pull request stored
  under repository `alpha`
- **THEN** the system SHALL return not found instead of exposing pull-request
  data

#### Scenario: Existing CLI pull-request list and edit behavior remains available
- **WHEN** a CLI caller uses the existing repository-path pull-request list or
  edit contract
- **THEN** `GET /api/pull-requests?repositoryPath=...` and
  `PATCH /api/pull-requests` SHALL remain available
- **AND** the new browser read model SHALL not require CLI callers to switch
  away from repository-path payloads

### Requirement: Pull-request activity history records forward-only state transitions
The system SHALL persist or reliably derive a pull-request activity timeline
that covers create, sync, edit, CI job start, CI job finish, and merge
transitions, and that timeline SHALL remain scoped to the owning repository
and pull request.

#### Scenario: New state transitions append ordered activity entries
- **WHEN** a pull request is created, synchronized, edited, claimed for CI,
  finished, or merged after this change lands
- **THEN** the system SHALL record an activity entry for that transition
- **AND** repository pull-request detail reads SHALL return the activity
  entries in a stable time order

#### Scenario: Legacy pull requests degrade gracefully when historical events are unavailable
- **WHEN** a repository pull-request detail read targets a pull request that
  predates the activity persistence change
- **THEN** the system SHALL still return the detail page
- **AND** the activity section SHALL fall back to whatever timeline can be
  derived from the stored pull-request and CI job records instead of failing

### Requirement: GitHub delegation metadata is best-effort and graceful
The system SHALL derive delegated GitHub pull-request metadata on the server
from repository Git configuration and stored pull-request branches when
possible, and SHALL degrade to a compare/create or unavailable state when a
canonical GitHub pull-request URL cannot be determined.

#### Scenario: GitHub remote data produces an actionable delegation link
- **WHEN** the repository has a usable GitHub `upstream` or GitHub-backed
  remote and the pull request has base/head branch metadata
- **THEN** the detail read model SHALL include GitHub delegation metadata for
  that repository and pull request
- **AND** the page SHALL render an enabled `Open on GitHub` action

#### Scenario: Missing or non-GitHub metadata does not break the repository PR page
- **WHEN** the repository lacks a usable GitHub remote or cannot derive a
  canonical GitHub pull-request URL
- **THEN** the pull-request detail page SHALL render a clear unavailable or
  fallback compare/create state
- **AND** the repo-scoped PR read SHALL still succeed

### Requirement: Repository pages link into pull-request monitoring
The system SHALL make the repository pull-request pages discoverable from the
existing repository route and shared owner helpers.

#### Scenario: Repository page links to the pull-request list
- **WHEN** a user views `/${user}/${repo}`
- **THEN** the page SHALL include navigation to `/${user}/${repo}/pull-requests`
- **AND** shared owner URL helpers SHALL provide canonical pull-request list
  and detail hrefs

### Requirement: Regression coverage protects repo-scoped pull-request pages and read models
The system SHALL add focused regressions for pull-request storage, services,
event/activity shaping, result-artifact parsing, REST routes, page 404
behavior, REST-only bootstrap behavior, client link construction, and
cross-repository isolation.

#### Scenario: Tests verify repo-scoped PR page boundaries
- **WHEN** Vitest coverage exercises repository pull-request pages and APIs
- **THEN** the tests SHALL verify REST-only bootstrap behavior,
  repo-scoped not-found handling, and repository mismatch rejection
- **AND** the tests SHALL verify activity shaping, workflow artifact parsing,
  polling or link helpers, and browser-safe response contracts

### Requirement: Materialized artifacts preserve canonical PR pages metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`feat(pr-pages): surface repository PR pages` and conventional-title metadata
`feat(pr-pages)` without altering the approved change path
`repo-pr-pages-a1-p1-add-repository-pr-pages`.

#### Scenario: Planner materializes the assigned PR pages change
- **WHEN** planner writes the proposal, design, spec, and tasks for this
  change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `feat(pr-pages): surface repository PR pages`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata
  instead of changing the proposal change path
