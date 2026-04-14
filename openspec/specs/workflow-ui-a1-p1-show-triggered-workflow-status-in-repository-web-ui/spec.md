# workflow-ui-a1-p1-show-triggered-workflow-status-in-repository-web-ui Specification

## Purpose
Define the repository-page behavior for showing current/latest pull-request-triggered workflow status by combining repository-scoped CI result artifacts with active pull request job state.
## Requirements
### Requirement: Repository workflow summaries stay repository-scoped and deterministic
The system SHALL build repository workflow summaries only from CI artifacts that belong to the selected repository, skip malformed artifact files defensively, and order the resulting branch summaries by most recent workflow activity first.

#### Scenario: Repository summary ignores malformed and foreign artifacts
- **WHEN** the repository workflow summary helper loads data for repository `alpha`
- **THEN** it SHALL read only artifact files under `.data/ci-results/alpha/`
- **AND** it SHALL ignore files that are not valid CI result artifacts
- **AND** it SHALL ignore artifact payloads whose `repositoryName` is not `alpha`

#### Scenario: Branch summaries are sorted newest first
- **WHEN** multiple valid workflow summaries exist for one repository
- **THEN** the system SHALL sort them by the most recent known workflow activity timestamp descending
- **AND** it SHALL use branch name ascending as the deterministic tie-breaker

### Requirement: Active pull request jobs provide the current branch status
The system SHALL combine finished CI artifacts with repository-scoped pull request `latestJob` state so queued and running work is visible before a replacement artifact exists.

#### Scenario: Active job without a finished artifact is still rendered
- **WHEN** a repository pull request has a `latestJob` with status `queued` or `running`
- **AND** no finished CI artifact exists yet for that branch
- **THEN** the repository workflow summary SHALL include that branch
- **AND** it SHALL render the branch name, latest commit hash, active status, and any available queued or started timestamps

#### Scenario: Newer active job overrides an older finished artifact
- **WHEN** a finished CI artifact exists for branch `feature/test`
- **AND** the repository pull request for `feature/test` has a newer `latestJob` with status `queued` or `running`
- **THEN** the repository workflow summary SHALL treat the active job as the current/latest status for that branch
- **AND** it SHALL not render the older finished artifact as the current branch state

### Requirement: Repository pages render explicit workflow status states
The repository page SHALL preserve the existing repository-root entry list and add a workflow-status panel that renders explicit empty, queued, running, succeeded, failed, and mixed-result states.

#### Scenario: Repository page renders an explicit empty workflow state
- **WHEN** a repository has no valid workflow summaries
- **THEN** `app/[user]/[repo]/page.tsx` SHALL render an explicit empty workflow-status state
- **AND** it SHALL continue to render the repository-root entry list on the same page

#### Scenario: Repository page renders workflow summary details
- **WHEN** a repository has at least one valid workflow summary
- **THEN** the page SHALL render the branch name, a short commit hash, and the overall workflow status for each branch summary
- **AND** it SHALL render per-workflow names and pass/fail statuses when the summary is backed by a finished CI artifact
- **AND** it SHALL render queued, started, and finished timestamps whenever those fields are available

#### Scenario: Repository page renders a mixed-result state for non-uniform summaries
- **WHEN** a repository page renders multiple branch summaries with different normalized statuses
- **THEN** the workflow-status panel SHALL render a mixed-result state
- **AND** each branch summary SHALL still display its own status and details
