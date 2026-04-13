## Why

The repository page currently shows repository-root entries but does not show whether pull-request-triggered workflows for that repository are queued, running, or finished. The server already has the two inputs needed for a current/latest summary, `.data/ci-results/<repo>/<branch>.json` artifacts and pull request `latestJob` state, so this change surfaces that status in the existing web UI without adding a separate dashboard or changing CI behavior.

## What Changes

- Add a server-only repository workflow summary helper under `lib/` that reads `.data/ci-results/<repo>/` artifacts, skips malformed files defensively, and normalizes repository branch summaries newest first.
- Combine finished artifact data with repository-scoped pull request `latestJob` state so queued and running work is visible before a replacement artifact exists, and newer active job state wins over an older finished artifact for the same branch.
- Extend `app/[user]/[repo]/page.tsx` with a workflow-status panel that preserves the current repository-root listing while adding explicit empty, queued, running, succeeded, failed, and mixed-result rendering.
- Show branch, short commit hash, overall status, per-workflow names and statuses, and queued, started, and finished timestamps when those fields are available from the underlying data.
- Add focused Vitest coverage for repository scoping, malformed artifact handling, deterministic ordering, active-job fallback and precedence, and repository page rendering, then run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

## Capabilities

### New Capabilities
- `workflow-ui-a3-p1-show-triggered-workflow-status-in-repository-web-ui`: Repository pages show the current/latest pull-request-triggered workflow status for each repository by combining CI artifacts with active PR job state.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `feat(workflow/ui): Show triggered workflow status in repository web UI`
- Conventional title metadata: `feat(workflow/ui)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter the OpenSpec change path `workflow-ui-a3-p1-show-triggered-workflow-status-in-repository-web-ui`.

## Impact

- Affected routes and helpers: `app/[user]/[repo]/page.tsx`, the repository helper area under `lib/`, and the existing PR runner result and pull-request summary contracts.
- Affected tests: repository workflow-summary unit coverage plus repository page rendering coverage in the existing Vitest suite.
- Data contract scope: read-only consumption of `.data/ci-results/<repo>/<branch>.json` and repository-scoped PR `latestJob` state; no changes to artifact writing, queueing, merge behavior, browser polling, or historical workflow dashboards.
