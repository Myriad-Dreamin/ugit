## ADDED Requirements

### Requirement: Successful CI leaves pull requests awaiting explicit merge approval
The system SHALL leave a pull request open in status `passed` after its latest
CI job succeeds, and it SHALL reserve status `merged` for a completed
approval-backed merge instead of automatic post-CI merge execution.

#### Scenario: Latest successful CI job becomes the merge candidate without merging
- **WHEN** the newest CI job for a pull request finishes successfully for the
  current pull-request head commit
- **THEN** the pull request SHALL store status `passed`
- **AND** repository pull-request list and detail reads SHALL keep the pull
  request in open state until an explicit merge approval succeeds
- **AND** the latest successful CI job SHALL remain available as the current
  merge candidate for readiness evaluation

### Requirement: Merge readiness is derived from current CI, base parity, and GitHub mergeability
The system SHALL derive merge readiness on the server from live state instead
of persisting a stale flag. A pull request is ready to merge only when the
latest successful CI job still matches the current head commit, the mirrored
local base branch matches the fetched GitHub remote base branch, and the
canonical GitHub pull request reports mergeable.

#### Scenario: All three readiness checks pass
- **WHEN** repo-scoped detail or merge validation loads a pull request whose
  latest successful CI job still matches the current head commit, whose
  mirrored local base branch matches the fetched GitHub base branch, and whose
  canonical GitHub pull request is mergeable
- **THEN** the pull-request read model SHALL mark the pull request ready to
  merge
- **AND** it SHALL expose the satisfied readiness checks without blocking
  reasons

#### Scenario: Stale CI, base drift, or pending GitHub mergeability blocks readiness
- **WHEN** the latest CI job is not a current success, or the fetched GitHub
  base commit differs from the mirrored local base branch, or GitHub reports
  the pull request as unmergeable or mergeability-pending
- **THEN** the pull-request read model SHALL mark the pull request not ready
- **AND** it SHALL expose specific blocking reasons for each unsatisfied check

### Requirement: Repository pull-request detail shows readiness and manual merge controls through repo-scoped REST
The system SHALL surface merge readiness, blocking reasons, and the manual
merge action on `/${user}/${repo}/pull-requests/[pullRequestId]` through
repo-scoped same-origin REST reads and writes without direct browser GitHub
calls or direct browser imports of backend pull-request services.

#### Scenario: Ready pull request enables the merge action
- **WHEN** a user views a repository pull-request detail page for a pull
  request that is ready to merge
- **THEN** the page SHALL render a readiness checklist with the current CI,
  base parity, and GitHub mergeability checks satisfied
- **AND** it SHALL enable a merge action that submits to
  `POST /api/pull-requests/[pullRequestId]/merge?repositoryName=<repo>`
- **AND** detail bootstrap and refresh SHALL continue to use repo-scoped
  same-origin REST reads

#### Scenario: Blocked pull request keeps merge disabled with actionable feedback
- **WHEN** a user views a repository pull-request detail page for a pull
  request that is not ready to merge
- **THEN** the page SHALL render the unsatisfied readiness checks and blocking
  reasons
- **AND** the merge action SHALL stay disabled or otherwise refuse submission
  without bypassing the repo-scoped REST boundary

### Requirement: The repo-scoped merge action revalidates readiness and rejects rebase-required branches
The system SHALL revalidate readiness on every merge request, confirm the
latest successful CI job still matches the current pull-request head commit,
and reject merges when the branch is no longer fast-forwardable from the
mirrored local base branch.

#### Scenario: Rebase is required before merge
- **WHEN** a user submits a merge request for a pull request whose head commit
  is no longer a fast-forward descendant of the mirrored local base branch
- **THEN** the merge endpoint SHALL reject the request without mutating GitHub
  or the mirrored local base branch
- **AND** the response SHALL instruct the user to rebase or update the branch
  and retry

#### Scenario: A stale page cannot merge an outdated CI result
- **WHEN** a user submits a merge request after a newer synchronization or CI
  result has changed the stored head commit or latest successful job
- **THEN** the merge endpoint SHALL return a not-ready response
- **AND** the response SHALL instruct the user to refresh and wait for the
  current head commit to pass CI again

### Requirement: Approved merges use GitHub squash merge and realign the mirrored base branch
The system SHALL execute a GitHub squash merge for the canonical pull request
after manual approval, then fetch the selected GitHub remote base branch and
update the mirrored local base branch to the latest GitHub base commit before
persisting merge completion.

#### Scenario: Successful approval-backed merge updates GitHub and the local mirror
- **WHEN** a ready pull request receives a merge approval and the merge action
  passes fast-forward preflight
- **THEN** the system SHALL perform a squash merge for the canonical GitHub
  pull request
- **AND** it SHALL fetch the selected GitHub remote base branch and update the
  mirrored local base branch to the fetched GitHub base commit
- **AND** it SHALL persist the pull request as `merged` with activity that
  records the completed approval-backed merge

### Requirement: GitHub-backed readiness and merge flows fail closed when credentials or canonical PR metadata are unavailable
The system SHALL keep GitHub authentication and canonical PR lookup on the
server, and it SHALL treat missing credentials or missing canonical PR metadata
as a not-ready or unavailable state instead of guessing mergeability.

#### Scenario: Missing GitHub credentials blocks readiness and merge
- **WHEN** the server cannot authenticate to GitHub or cannot resolve the
  canonical GitHub pull request for the repository and branch metadata
- **THEN** the pull request SHALL remain not ready to merge
- **AND** repo-scoped detail reads and merge responses SHALL surface a clear
  unavailable message without exposing credentials

### Requirement: Regression coverage and docs protect the manual approval flow
The system SHALL add focused regression coverage and README documentation for
the approval flow, readiness evaluation, GitHub integration behavior, and
rebase-required failures.

#### Scenario: Tests and docs cover the approval lifecycle
- **WHEN** implementation lands for the manual merge approval flow
- **THEN** Vitest coverage SHALL verify readiness evaluation, GitHub helper
  behavior, storage and status transitions, merge route and service handling,
  mirrored-base reset behavior, and repository PR detail UI states
- **AND** `README.md` SHALL describe the manual approval flow, required GitHub
  credentials, and the user-facing rebase guidance when a branch is no longer
  fast-forwardable

### Requirement: Materialized artifacts preserve canonical PR merge metadata
The materialized OpenSpec artifacts SHALL carry the canonical request/PR title
`feat(pr/merge): require manual PR merge approval` and conventional-title
metadata `feat(pr/merge)` without altering the approved change path
`manual-pr-merge-a1-p1-add-manual-pr-merge-approval-flow`.

#### Scenario: Planner materializes the assigned manual-merge change
- **WHEN** planner writes the proposal, design, spec, and tasks for this
  change
- **THEN** each artifact SHALL reference the canonical request/PR title
  `feat(pr/merge): require manual PR merge approval`
- **AND** the slash-delimited roadmap/topic scope SHALL remain metadata instead
  of changing the proposal change path
