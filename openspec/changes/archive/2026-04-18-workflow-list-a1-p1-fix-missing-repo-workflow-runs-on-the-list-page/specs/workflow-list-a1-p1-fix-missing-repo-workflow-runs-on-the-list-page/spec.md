## ADDED Requirements

### Requirement: Repository workflow list shows recorded repo workflow runs through the queue-to-list path
The system SHALL make a workflow run that was queued for repository
`repositoryName` visible to repo-scoped workflow list reads for that same
repository once the run record exists, so `/${user}/${repo}/workflows` does
not stay in the empty state while the run already has workflow metadata and
logs.

#### Scenario: Queued workflow run appears in repo-scoped list bootstrap
- **WHEN** a workflow run is queued for repository `alpha` through the
  repository workflow run entry point and the run record is stored for `alpha`
- **THEN** `GET /api/workflows/runs?repositoryName=alpha` SHALL include that
  workflow run
- **AND** the server bootstrap for `/${user}/${repo}/workflows` SHALL render
  that run for repository `alpha`

#### Scenario: Active or completed workflow run remains visible during list refresh
- **WHEN** a user keeps `/${user}/${repo}/workflows` open while a repository
  workflow run for `alpha` moves through `queued`, `running`, or a terminal
  status
- **THEN** repo-scoped refreshes through `GET /api/workflows/runs` SHALL keep
  returning that workflow run for `alpha`
- **AND** the page SHALL not regress to the "No workflow runs have been
  recorded" empty state while the run still belongs to that repository

### Requirement: Repo-scoped workflow reads use aligned repository identity across validation and storage
The system SHALL align queue validation, workflow-run storage, and repo-scoped
workflow list reads around the same server-resolved repository identity so a
recorded workflow run remains visible for its owning repository even when path
or normalization details differ across queue and read boundaries.

#### Scenario: Repo-scoped list reads survive repository identity normalization drift
- **WHEN** workflow queue validation resolves repository `alpha` and the stored
  workflow run later has path or normalization details that differ from a later
  resolved repository path string for `alpha`
- **THEN** repo-scoped list reads for `alpha` SHALL still match and return that
  workflow run
- **AND** the browser-facing response SHALL continue omitting raw repository
  filesystem paths

### Requirement: Repo-scoped workflow run visibility preserves repository isolation
The system SHALL keep repository workflow list visibility strict so a workflow
run stored for one repository cannot appear on another repository's list page
or repo-scoped list API response.

#### Scenario: Repo-scoped list excludes workflow runs owned by another repository
- **WHEN** repository `beta` reads `/${user}/${repo}/workflows` or
  `GET /api/workflows/runs?repositoryName=beta` while the stored workflow run
  belongs to repository `alpha`
- **THEN** the system SHALL omit that workflow run from the repo-scoped
  response for `beta`
- **AND** the page bootstrap for `beta` SHALL not hydrate workflow data from
  repository `alpha`

### Requirement: Regression coverage protects the queue-to-list workflow visibility path
The system SHALL add focused regressions for workflow storage, service, API,
and page flows so repo-scoped workflow list reads continue to surface recorded
repository workflow runs after queueing and still reject true cross-repository
mismatches.

#### Scenario: Tests lock in repo workflow visibility from queue to list
- **WHEN** Vitest coverage exercises workflow queueing, repo-scoped list reads,
  and repository workflow page bootstrap and refresh
- **THEN** the tests SHALL verify that queued, running, and completed workflow
  runs remain visible for the owning repository
- **AND** the tests SHALL verify that another repository still cannot list or
  hydrate those workflow runs

### Requirement: Materialized artifacts preserve canonical workflow-run metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`fix(workflow/runs): Show repo workflow runs` and conventional-title metadata
`fix(workflow/runs)` without altering the approved change path
`workflow-list-a1-p1-fix-missing-repo-workflow-runs-on-the-list-page`.

#### Scenario: Planner materializes the assigned workflow-list change
- **WHEN** planner writes the proposal, design, spec, and tasks for this
  change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `fix(workflow/runs): Show repo workflow runs`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
