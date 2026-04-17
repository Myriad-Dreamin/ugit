## ADDED Requirements

### Requirement: Repository workflow list page bootstraps initial data through the workflow REST API
The system SHALL load the initial workflow summaries for
`/${user}/${repo}/workflows` through the REST read contract served at
`/api/workflows/runs`, and App Router page code for that route SHALL not import
workflow backend storage/service modules directly.

#### Scenario: Valid repository workflow route renders from a REST-backed bootstrap
- **WHEN** a browser requests `/${user}/${repo}/workflows` for the configured
  owner and an existing repository
- **THEN** the page SHALL validate the owner and repository before bootstrapping
  workflow data
- **AND** the initial workflow summaries SHALL be loaded through
  `/api/workflows/runs` using repo-scoped parameters instead of a direct
  workflow service import
- **AND** browser-facing props SHALL not include `repositoryPath`

#### Scenario: Unknown owner or repository is rejected before workflow bootstrap
- **WHEN** a browser requests `/${user}/${repo}/workflows` for an unsupported
  owner or a repository that is not present under the configured repositories
  root
- **THEN** the system SHALL return not found instead of attempting the REST
  bootstrap or a workflow storage read

### Requirement: Repository workflow list keeps the existing live REST refresh behavior
The system SHALL preserve the current live list polling behavior after moving
first-render bootstrap to REST.

#### Scenario: Active workflow summaries keep refreshing
- **WHEN** a user keeps `/${user}/${repo}/workflows` open while workflow-run
  statuses change for that repository
- **THEN** the browser SHALL continue refreshing workflow summaries through
  `/api/workflows/runs` without a full page reload

### Requirement: Workflow list page and REST boundary regression coverage detect backend leakage
The system SHALL add regression tests around the list page and
`/api/workflows/runs` boundary so repo-scoped workflow data remains REST-backed
and browser-visible payloads do not leak backend storage details.

#### Scenario: Page tests assert REST-backed bootstrap
- **WHEN** workflow list page tests exercise the initial render path
- **THEN** they SHALL verify repo-scoped owner and repository validation still
  happens in the page
- **AND** they SHALL verify the page bootstraps workflow summaries through the
  REST contract rather than a direct workflow backend service import
- **AND** they SHALL verify client props omit `repositoryPath`

#### Scenario: API tests assert repo-scoped workflow list reads
- **WHEN** `/api/workflows/runs` tests exercise the list read contract
- **THEN** they SHALL verify repo-scoped query handling, not-found behavior,
  and JSON payloads that satisfy both initial page bootstrap and live refresh
- **AND** they SHALL avoid relying on raw repository filesystem paths in
  browser-facing requests or responses

### Requirement: Agent guidance enforces the workflow REST page boundary
The repository guidance SHALL state that App Router pages and page-scoped
components MUST use workflow REST endpoints under `app/api` for workflow reads
and MUST NOT import workflow backend storage/service modules directly.

#### Scenario: Workflow page guidance is consulted for a future change
- **WHEN** an agent plans or edits workflow App Router page code
- **THEN** `AGENTS.md` SHALL instruct the agent to use REST endpoints under
  `app/api` for workflow page reads
- **AND** the guidance SHALL treat workflow storage/service modules as
  server-only internals rather than page-layer dependencies

### Requirement: Workflow detail page boundary risk is resolved or explicitly deferred
The change SHALL audit `/${user}/${repo}/workflows/[workflowId]` for the same
direct-service boundary smell and SHALL either route its initial finite
bootstrap through REST or record an explicit scoped follow-up note when that
bootstrap would require a broader API redesign.

#### Scenario: Detail page can reuse a minimal REST bootstrap
- **WHEN** implementation can obtain the detail page's initial structured data
  through an existing or minimally extended REST contract without redesigning
  log streaming
- **THEN** the system SHALL migrate the detail page's initial read behind REST
- **AND** the page SHALL preserve its current status polling and log streaming
  behavior

#### Scenario: Detail page needs broader API work
- **WHEN** moving the detail page's initial read behind REST would require a
  larger API redesign than this change allows
- **THEN** the change SHALL preserve current detail page behavior
- **AND** the materialized work SHALL include an explicit scoped follow-up note
  describing the remaining boundary smell

### Requirement: Materialized artifacts preserve canonical workflow REST metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`fix(workflows/rest): route workflow page reads through REST API` and
conventional-title metadata `fix(workflows/rest)` without altering the approved
change path `workflow-rest-a1-p1-route-workflow-page-reads-through-rest-api`.

#### Scenario: Planner materializes the assigned workflow REST change
- **WHEN** planner writes the proposal, design, spec, and tasks for this change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `fix(workflows/rest): route workflow page reads through REST API`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
