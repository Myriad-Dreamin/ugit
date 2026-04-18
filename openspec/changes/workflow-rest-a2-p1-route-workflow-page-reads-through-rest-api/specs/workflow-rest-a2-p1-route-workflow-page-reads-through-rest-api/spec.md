## ADDED Requirements

### Requirement: Repository workflow list pages bootstrap workflow summaries through the REST API
The system SHALL bootstrap `/${user}/${repo}/workflows` through
`GET /api/workflows/runs` and SHALL not import workflow storage or workflow
read service modules directly inside the App Router page for that
browser-facing read.

#### Scenario: Repository workflow list page uses the workflow runs REST endpoint for initial data
- **WHEN** a browser requests `/${user}/${repo}/workflows` for the configured
  owner and an existing repository
- **THEN** the page SHALL resolve repo context on the server and fetch initial
  workflow summaries through `GET /api/workflows/runs`
- **AND** the bootstrap data passed into `WorkflowRunsListClient` SHALL match
  the workflow runs REST response shape without requiring raw
  `repositoryPath` fields

#### Scenario: Repository workflow list page rejects unknown owner or repository before bootstrapping
- **WHEN** a browser requests `/${user}/${repo}/workflows` for an unsupported
  owner or a repository that does not exist
- **THEN** the system SHALL return not found instead of attempting the workflow
  runs REST bootstrap

### Requirement: Server-side workflow REST bootstrap derives a safe absolute origin
The system SHALL derive the absolute origin for server-side
`GET /api/workflows/runs` bootstrap requests from request context rather than a
hardcoded host so local development and forwarded-host environments remain
valid.

#### Scenario: Local development hosts bootstrap through their own origin
- **WHEN** the repository workflow list page renders under local host forms such
  as `localhost`, `127.0.0.1`, or `[::1]`
- **THEN** the server-side bootstrap request SHALL target the same origin as
  the incoming request
- **AND** the implementation SHALL not hardcode `localhost` as the internal
  workflow REST host

#### Scenario: Forwarded host and protocol headers preserve the visible origin
- **WHEN** the page renders behind a proxy that supplies forwarded host or
  protocol headers
- **THEN** the server-side bootstrap request SHALL derive its absolute origin
  from that request context so the workflow runs REST call stays on the correct
  visible origin

### Requirement: Live workflow list polling remains on the workflow runs REST endpoint
The system SHALL preserve the existing client-side workflow list refresh path
after moving the initial list-page bootstrap behind REST.

#### Scenario: Workflow list client keeps polling after initial REST bootstrap
- **WHEN** a user keeps `/${user}/${repo}/workflows` open while workflow-run
  statuses change
- **THEN** `WorkflowRunsListClient` SHALL continue polling
  `GET /api/workflows/runs` for refreshes
- **AND** the REST bootstrap refactor SHALL not require a full page reload to
  observe updated workflow statuses

### Requirement: Regression coverage and workflow-page guidance protect the REST boundary
The system SHALL add regression coverage and repository guidance so the
workflow list page does not regress to direct workflow-service or storage
imports for browser-facing reads.

#### Scenario: Page or API tests verify the workflow page boundary
- **WHEN** workflow list page or related REST tests exercise the initial
  bootstrap path
- **THEN** they SHALL verify that the page no longer depends on direct workflow
  read service imports for its initial browser-facing data
- **AND** they SHALL verify that server-side REST bootstrap origin handling
  works for local host forms such as loopback or IPv6

#### Scenario: AGENTS guidance documents the workflow-page REST rule
- **WHEN** repository guidance is updated for this change
- **THEN** `AGENTS.md` SHALL state that App Router workflow pages must not
  import workflow storage or service modules directly for browser-facing reads
- **AND** the guidance SHALL direct workflow page bootstrap reads through REST
  endpoints instead

### Requirement: Materialized artifacts preserve canonical workflow REST metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`fix(workflows/rest): route workflow page reads through REST API` and
conventional title metadata `fix(workflows/rest)` without altering the approved
change path `workflow-rest-a2-p1-route-workflow-page-reads-through-rest-api`.

#### Scenario: Planner materializes the assigned workflow REST proposal
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `fix(workflows/rest): route workflow page reads through REST API`
- **AND** the slash-delimited roadmap or topic scope SHALL remain metadata
  instead of changing the proposal change path
