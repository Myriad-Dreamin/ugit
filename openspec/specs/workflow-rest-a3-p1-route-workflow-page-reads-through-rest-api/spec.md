# workflow-rest-a3-p1-route-workflow-page-reads-through-rest-api Specification

## Purpose
Define the REST-only bootstrap boundary for the repository workflow list page
so server-rendered reads flow through `/api/workflows/runs`, preserve live
polling behavior after hydration, and construct safe same-origin bootstrap
URLs.
## Requirements
### Requirement: Repository workflow list page bootstraps through the repo-scoped REST list API
The system SHALL load the initial workflow summaries for
`/${user}/${repo}/workflows` through `GET /api/workflows/runs` after owner and
repository validation, and `RepositoryWorkflowsPage` SHALL not import backend
workflow-run services directly for that browser-facing read.

#### Scenario: Valid repository workflow route bootstraps through REST
- **WHEN** a browser requests `/${user}/${repo}/workflows` for the configured
  owner and an existing repository
- **THEN** the system SHALL validate the owner and repository before loading
  workflow summaries
- **AND** the initial workflow-run read SHALL go through
  `GET /api/workflows/runs`

#### Scenario: Unknown owner or repository is rejected before the bootstrap read
- **WHEN** a browser requests `/${user}/${repo}/workflows` for an unsupported
  owner or a repository that is not present under the configured repositories
  root
- **THEN** the system SHALL return not found
- **AND** it SHALL not invoke backend workflow storage reads for the page
  bootstrap

### Requirement: Workflow list live monitoring remains unchanged after the REST bootstrap refactor
The system SHALL preserve the existing live workflow summary polling behavior
after the repository workflow list page switches its server bootstrap to the
REST API.

#### Scenario: Active workflow summaries continue polling through the runs API
- **WHEN** a user keeps `/${user}/${repo}/workflows` open while workflow-run
  statuses change for that repository
- **THEN** the browser SHALL continue refreshing workflow summaries through
  `GET /api/workflows/runs`
- **AND** it SHALL not require a manual full-page reload

### Requirement: Server-side workflow bootstrap builds a safe same-origin REST URL
The system SHALL construct an absolute same-origin URL for the server-rendered
workflow list bootstrap read so App Router rendering can call
`GET /api/workflows/runs` safely across forwarded host and protocol contexts.

#### Scenario: Bootstrap URL preserves origin and repository query
- **WHEN** the server renders `/${user}/${repo}/workflows` with host or
  forwarded host and protocol context available
- **THEN** the system SHALL build an absolute URL for `/api/workflows/runs`
- **AND** the `repositoryName` query parameter SHALL match the resolved
  repository name

### Requirement: Regression coverage protects the workflow page and REST boundary
The system SHALL add focused regressions for the workflow list page and runs API
so the bootstrap path stays on the REST boundary and server-side URL handling
remains correct.

#### Scenario: Page tests assert REST-only bootstrap behavior
- **WHEN** repository workflow page tests exercise `/${user}/${repo}/workflows`
- **THEN** they SHALL verify that initial workflow data is loaded through the
  REST boundary
- **AND** they SHALL verify that browser-facing props do not depend on direct
  backend workflow service imports

#### Scenario: Runs API tests assert bootstrap URL handling
- **WHEN** workflow-runs boundary tests exercise the list-page bootstrap
  contract and runs API request handling
- **THEN** they SHALL verify repo-scoped query behavior and server-side
  origin-aware URL construction for `/api/workflows/runs`

### Requirement: Workflow page contributor guidance documents REST-only reads
The repository SHALL document that browser-facing workflow pages use repo-scoped
REST endpoints for reads and SHALL not import backend workflow services
directly.

#### Scenario: AGENTS guidance covers workflow page reads
- **WHEN** contributors consult `AGENTS.md` before modifying workflow pages
- **THEN** the document SHALL state that browser-facing workflow pages must use
  repo-scoped REST endpoints for reads
- **AND** it SHALL forbid direct imports of backend workflow services for those
  reads

### Requirement: Materialized artifacts preserve canonical workflow REST metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`fix(workflows/rest): route workflow page reads through REST API` and
conventional-title metadata `fix(workflows/rest)` without altering the approved
change path `workflow-rest-a3-p1-route-workflow-page-reads-through-rest-api`.

#### Scenario: Planner materializes the assigned workflow REST change
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `fix(workflows/rest): route workflow page reads through REST API`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
