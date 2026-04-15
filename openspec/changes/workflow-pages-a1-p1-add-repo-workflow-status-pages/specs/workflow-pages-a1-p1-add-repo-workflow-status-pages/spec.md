## ADDED Requirements

### Requirement: Repository workflow list page shows repo-scoped workflow runs
The system SHALL serve `/${user}/${repo}/workflows` for the configured owner and a discovered repository, and that page SHALL show workflow runs for that repository only with links to per-run detail pages.

#### Scenario: Valid repository workflow route renders workflow runs
- **WHEN** a browser requests `/${user}/${repo}/workflows` for the configured owner and an existing repository
- **THEN** the system SHALL render a workflow status page for that repository
- **AND** each rendered workflow run SHALL link to `/${user}/${repo}/workflows/[workflowId]`

#### Scenario: Unknown owner or repository is rejected
- **WHEN** a browser requests `/${user}/${repo}/workflows` for an unsupported owner or a repository that is not present under the configured repositories root
- **THEN** the system SHALL return not found instead of rendering workflow data

#### Scenario: Active workflow summaries refresh without a full page reload
- **WHEN** a user keeps `/${user}/${repo}/workflows` open while workflow-run statuses change for that repository
- **THEN** the browser SHALL refresh the workflow summaries through polling without requiring a manual full-page refresh

### Requirement: Workflow detail page shows live repo-scoped status and logs
The system SHALL serve `/${user}/${repo}/workflows/[workflowId]` for workflow runs that belong to the requested repository and SHALL display current workflow metadata, status, and log output.

#### Scenario: Repo-owned workflow detail renders current status
- **WHEN** a browser requests `/${user}/${repo}/workflows/[workflowId]` for a workflow run whose stored repository matches the requested repository
- **THEN** the system SHALL render the workflow run detail page with the run's workflow name, status, branch, commit, and timestamps

#### Scenario: Cross-repository or missing workflow ids do not leak data
- **WHEN** a browser requests `/${user}/${repo}/workflows/[workflowId]` and that workflow id is missing or belongs to a different repository
- **THEN** the system SHALL return not found instead of exposing workflow metadata or logs

#### Scenario: Active workflow detail keeps status current and follows logs
- **WHEN** a user views `/${user}/${repo}/workflows/[workflowId]` while the workflow run remains `queued` or `running`
- **THEN** the browser SHALL keep the run status current through polling
- **AND** the page SHALL reuse the existing workflow log stream to append live log output until the run reaches a terminal state

### Requirement: Workflow read APIs are repo-scoped and browser-friendly
The system SHALL expose repo-scoped workflow-run list and detail read APIs backed by the existing SQLite workflow-run storage, and every read SHALL verify that the requested repository owns the returned workflow data.

#### Scenario: Repository workflow list API returns only matching workflow runs
- **WHEN** a client requests the workflow-run list API for a repository
- **THEN** the system SHALL return only workflow runs whose stored repository matches that repository
- **AND** the response SHALL include the fields needed to render repo workflow summaries in the browser

#### Scenario: Workflow detail API rejects repository mismatches
- **WHEN** a client requests the workflow-run detail API for a workflow id and repository context that do not match
- **THEN** the system SHALL return not found instead of returning workflow-run data

### Requirement: Repository pages link into workflow monitoring
The system SHALL make the repo workflow UI discoverable from the existing repository page.

#### Scenario: Repository page links to the workflow list
- **WHEN** a user views `/${user}/${repo}`
- **THEN** the page SHALL include navigation to `/${user}/${repo}/workflows`

### Requirement: Materialized artifacts preserve canonical workflow-page metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title `feat(repo/workflows): surface repo workflow status` and conventional-title metadata `feat(repo/workflows)` without altering the approved change path `workflow-pages-a1-p1-add-repo-workflow-status-pages`.

#### Scenario: Planner materializes the assigned change
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title `feat(repo/workflows): surface repo workflow status`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead of changing the proposal change path
