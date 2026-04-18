# workflow-list-a1-p1-show-manual-workflow-runs-in-repository-workflow-pag Specification

## Purpose
Define stable repository-identity reads for repository workflow pages so
manual workflow runs remain visible after repository-path drift without
weakening repo-scoped isolation.
## Requirements
### Requirement: Repository workflow reads use the stored repository identity
The system SHALL scope repository workflow list, detail, and repo-scoped log
reads by the stored workflow-run `repository_name` after the requested
repository name is resolved on the server, so manual workflow runs remain
visible even when the stored `repository_path` no longer matches the current
resolved path string.

#### Scenario: Repository workflow list returns a manual run after path drift
- **WHEN** a stored manual workflow run belongs to repository `alpha`, the
  requested repository workflow route resolves to `alpha`, and the stored
  `repository_path` differs from the currently resolved repository path string
- **THEN** `/${user}/${repo}/workflows` and
  `GET /api/workflows/runs?repositoryName=alpha` SHALL include that workflow
  run
- **AND** the browser-facing response SHALL continue omitting raw repository
  filesystem paths

#### Scenario: Repository workflow detail and log reads use the same stable identity
- **WHEN** a browser or repo-scoped API reads
  `/${user}/${repo}/workflows/[workflowId]`,
  `GET /api/workflows/runs/[workflowId]?repositoryName=alpha`, or
  `GET /api/workflows/logs?workflowId=<id>&repositoryName=alpha` for a stored
  run whose `repository_name` matches `alpha`
- **THEN** the system SHALL return the workflow detail or log stream even if
  the stored `repository_path` differs from the currently resolved path string
- **AND** workflow-id log reads that omit `repositoryName` SHALL remain
  available for the existing CLI contract

### Requirement: Repository workflow reads preserve cross-repository isolation
The system SHALL keep repo-scoped workflow reads strict so a workflow run
stored for one repository cannot be returned from a different repository route
or repo-scoped API request.

#### Scenario: Repo-scoped read rejects a workflow id from another repository
- **WHEN** a repository workflow detail or log read names repository `beta`
  for a workflow run stored under repository `alpha`
- **THEN** the system SHALL return not found for that repo-scoped request
- **AND** it SHALL not fall back to workflow-id-only matching for that
  repository-scoped read

### Requirement: Regression coverage protects repository identity handling
The system SHALL add focused regressions for workflow storage, service, API,
and page flows so path-alias or repository-root drift mismatches do not hide
manual workflow runs and true cross-repository mismatches remain rejected.

#### Scenario: Tests lock in stable repo identity and strict repo mismatch behavior
- **WHEN** Vitest coverage exercises workflow storage, service, API, and page
  reads for manual workflow runs
- **THEN** the tests SHALL verify that matching `repository_name` survives
  path-alias or root-drift mismatches for repo-scoped list, detail, and log
  reads
- **AND** the tests SHALL verify that true cross-repository requests still
  return not found or omit the run from repo-scoped responses

### Requirement: Materialized artifacts preserve canonical workflow metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`fix(repo/workflows): show manual workflow runs` and conventional-title
metadata `fix(repo/workflows)` without altering the approved change path
`workflow-list-a1-p1-show-manual-workflow-runs-in-repository-workflow-pag`.

#### Scenario: Planner materializes the assigned workflow-list change
- **WHEN** planner writes the proposal, design, spec, and tasks for this
  change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `fix(repo/workflows): show manual workflow runs`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
