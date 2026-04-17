# workflow-server-boundary-a1-p1-move-workflow-reads-behind-server-only-re Specification

## Purpose
Define the workflow list, detail, and log-read server-boundary behavior so
repository context is resolved on the server from repo-scoped identifiers
before SQLite-backed workflow storage access, while browser-facing workflow
contracts never expose raw repository filesystem paths.
## Requirements
### Requirement: Workflow pages resolve repository context on the server before workflow storage reads
The system SHALL resolve repository context for `/${user}/${repo}/workflows`
and `/${user}/${repo}/workflows/[workflowId]` on the server before any
SQLite-backed workflow storage read occurs, and browser-facing workflow page
contracts SHALL not require raw repository filesystem paths.

#### Scenario: Repository workflow list page renders from server-resolved repo context
- **WHEN** a browser requests `/${user}/${repo}/workflows` for the configured
  owner and an existing repository
- **THEN** the system SHALL resolve that repository on the server before reading
  workflow-run storage
- **AND** the list page's browser-facing workflow read contract SHALL omit raw
  `repositoryPath` fields

#### Scenario: Repository workflow detail page rejects unknown owner or repository before storage reads
- **WHEN** a browser requests `/${user}/${repo}/workflows/[workflowId]` for an
  unsupported owner or a repository that is not present under the configured
  repositories root
- **THEN** the system SHALL return not found instead of attempting a workflow
  storage read

### Requirement: Workflow read APIs use repo-scoped identifiers instead of path-based read payloads
The system SHALL expose workflow list, detail, and log read entry points that
resolve repository ownership on the server from repo-scoped route or identifier
context, and those browser-facing contracts SHALL not require raw repository
filesystem paths.

#### Scenario: Workflow list API resolves repository context on the server
- **WHEN** the browser refreshes workflow summaries for a repository workflow
  page
- **THEN** the workflow list read path SHALL derive the repository on the
  server from repo-scoped context before touching SQLite-backed storage
- **AND** the response SHALL include the fields needed to render workflow
  summaries without returning `repositoryPath`

#### Scenario: Workflow detail and log reads reject repository mismatches without browser-supplied paths
- **WHEN** the browser refreshes workflow detail or streams logs for
  `/${user}/${repo}/workflows/[workflowId]`
- **THEN** the system SHALL resolve the repository on the server before reading
  workflow storage or logs
- **AND** the system SHALL return not found when the workflow id is missing or
  belongs to a different repository

### Requirement: Live workflow monitoring behavior survives the server-boundary refactor
The system SHALL preserve the current live workflow monitoring behavior after
moving repository resolution and workflow storage entry selection behind
server-only repo resolution.

#### Scenario: Repository workflow list keeps polling active runs
- **WHEN** a user keeps `/${user}/${repo}/workflows` open while workflow-run
  statuses change for that repository
- **THEN** the browser SHALL continue refreshing workflow summaries through the
  updated repo-scoped read contract without a full page reload

#### Scenario: Workflow detail keeps status and logs current
- **WHEN** a user views `/${user}/${repo}/workflows/[workflowId]` while the
  workflow run remains `queued` or `running`
- **THEN** the browser SHALL continue polling for structured workflow status
  updates
- **AND** the page SHALL continue streaming log output until the workflow
  reaches a terminal state

### Requirement: Regression coverage protects the workflow read boundary
The system SHALL add regression tests for workflow pages and the affected
workflow read APIs so raw repository filesystem paths do not return to
browser-facing workflow reads.

#### Scenario: Page tests assert server-only repository path handling
- **WHEN** workflow page tests exercise the list and detail routes
- **THEN** they SHALL verify that repository resolution happens on the server
- **AND** they SHALL verify that browser client props no longer carry
  `repositoryPath`

#### Scenario: API tests assert repo-scoped workflow reads
- **WHEN** workflow read API tests exercise list, detail, and log entry points
- **THEN** they SHALL verify repo-scoped repository resolution, not-found
  handling for repo mismatches, and live refresh or log-stream request behavior
- **AND** they SHALL avoid relying on raw repository paths in browser-facing
  requests

### Requirement: Materialized artifacts preserve canonical workflow storage metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`fix(workflows/storage): move workflow reads server-side` and conventional-title
metadata `fix(workflows/storage)` without altering the approved change path
`workflow-server-boundary-a1-p1-move-workflow-reads-behind-server-only-re`.

#### Scenario: Planner materializes the assigned workflow server-boundary change
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `fix(workflows/storage): move workflow reads server-side`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
