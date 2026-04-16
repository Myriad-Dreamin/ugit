## ADDED Requirements

### Requirement: Workflow pages keep repository resolution behind server boundaries
The system SHALL resolve workflow page repository context on the server before reading SQLite-backed workflow storage, and browser props for the workflow list and detail pages SHALL not include raw repository filesystem paths.

#### Scenario: Repository workflow list page renders with server-resolved repository context
- **WHEN** a browser requests `/${user}/${repo}/workflows` for the configured owner and an existing repository
- **THEN** the system SHALL resolve that repository on the server before reading workflow-run storage
- **AND** the rendered browser client contract SHALL omit the repository's raw filesystem path

#### Scenario: Repository workflow detail page rejects unknown owner or repository before workflow storage reads
- **WHEN** a browser requests `/${user}/${repo}/workflows/[workflowId]` for an unsupported owner or a repository that is not present under the configured repositories root
- **THEN** the system SHALL return not found instead of attempting a workflow storage read

### Requirement: Workflow read APIs use repo-scoped context instead of raw repository paths
The system SHALL expose workflow list, detail, and log read contracts that resolve repository ownership on the server from repo-scoped route or identifier context, and those browser-facing contracts SHALL not require raw repository filesystem paths.

#### Scenario: Workflow list read contract resolves the repository on the server
- **WHEN** the browser refreshes workflow summaries for a repository workflow page
- **THEN** the workflow list read entry point SHALL derive the repository on the server from repo-scoped context
- **AND** the response SHALL include the fields needed to render workflow summaries without returning `repositoryPath`

#### Scenario: Workflow detail and log reads reject repository mismatches without browser-supplied paths
- **WHEN** the browser refreshes workflow detail or streams logs for `/${user}/${repo}/workflows/[workflowId]`
- **THEN** the system SHALL resolve the repository on the server before reading workflow storage or logs
- **AND** the system SHALL return not found when the workflow id is missing or belongs to a different repository

### Requirement: Live workflow monitoring behavior survives the server-boundary fix
The system SHALL preserve the current live workflow monitoring behavior after moving repository resolution and workflow storage entry selection behind server boundaries.

#### Scenario: Repository workflow list keeps polling active runs
- **WHEN** a user keeps `/${user}/${repo}/workflows` open while workflow-run statuses change for that repository
- **THEN** the browser SHALL continue refreshing workflow summaries through the updated read contract without requiring a full page reload

#### Scenario: Workflow detail keeps status and logs current
- **WHEN** a user views `/${user}/${repo}/workflows/[workflowId]` while the workflow run remains `queued` or `running`
- **THEN** the browser SHALL continue polling for structured workflow status updates
- **AND** the page SHALL continue streaming log output until the workflow reaches a terminal state

### Requirement: Regression coverage protects the workflow server boundary
The system SHALL add regression tests for the workflow page render contract and the affected workflow read APIs so raw repository filesystem paths do not return to browser-facing workflow reads.

#### Scenario: Page tests assert server-only repository path handling
- **WHEN** workflow page tests exercise the list and detail routes
- **THEN** they SHALL verify that repository resolution happens on the server
- **AND** they SHALL verify that browser client props no longer carry `repositoryPath`

#### Scenario: API tests assert repo-scoped workflow reads
- **WHEN** workflow read API tests exercise list, detail, and log entry points
- **THEN** they SHALL verify repo-scoped repository resolution, not-found handling for repo mismatches, and the live refresh or log-stream request contract without relying on raw repository paths

### Requirement: Materialized artifacts preserve canonical workflow storage metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title `fix(workflows/storage): move workflow storage server-side` and conventional-title metadata `fix(workflows/storage)` without altering the approved change path `workflow-server-boundary-a1-p1-keep-workflow-storage-behind-server-bound`.

#### Scenario: Planner materializes the assigned workflow server-boundary change
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title `fix(workflows/storage): move workflow storage server-side`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path
