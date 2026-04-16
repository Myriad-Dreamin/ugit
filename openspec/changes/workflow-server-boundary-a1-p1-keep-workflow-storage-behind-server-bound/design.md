## Context

The current workflow pages already start from route-safe server context:

- `app/[user]/[repo]/workflows/page.tsx` and `app/[user]/[repo]/workflows/[workflowId]/page.tsx` validate the configured owner, look up the repository with `getRepositoryByName`, and call server-only workflow services.
- That server lookup immediately crosses back into a browser-facing contract: the pages pass `repository.path` into `WorkflowRunsListClient` and `WorkflowRunDetailClient`, and those clients poll `/api/workflows/runs`, `/api/workflows/runs/[workflowId]`, and `/api/workflows/logs` with `repositoryPath` query parameters.
- `WorkflowRunSummary` also includes `repositoryPath`, so the browser receives backend filesystem paths even though it only needs repo-scoped workflow status and workflow ids.
- The read services and validation layer normalize the incoming repository path and then touch SQLite-backed workflow storage in `lib/pr-runner/storage.ts`, so the current page and API slice treats a server filesystem path as part of the browser contract.

The implementation target is not to remove server-side workflow storage reads. Those reads belong on the server. The change is to keep repository resolution and storage access selection fully behind server-only loaders or route handlers, while preserving the existing workflow list/detail experience, polling cadence, and log streaming.

## Goals / Non-Goals

**Goals:**
- Keep repository resolution inside server components, route handlers, or other server-only helpers before any workflow storage read occurs.
- Remove raw repository filesystem paths from browser props, browser polling requests, and browser-facing workflow read DTOs.
- Preserve the current workflow list page, detail page, polling behavior, and live log streaming semantics for active runs.
- Keep repo ownership checks and not-found behavior intact for list, detail, and log reads.
- Add regression tests for the page render contract and the affected workflow read APIs.
- Preserve the canonical request/PR title `fix(workflows/storage): move workflow storage server-side` and conventional-title metadata `fix(workflows/storage)` throughout the materialized artifacts.

**Non-Goals:**
- Change manual workflow queueing behavior or unrelated pull-request APIs.
- Redesign the workflow UI, polling cadence, or log stream transport.
- Introduce new workflow storage tables or migrations unless implementation uncovers a confirmed storage-layer defect that blocks the fix.
- Replace server-side workflow services with client-side data access of any kind.

## Decisions

- Keep `repositoryPath` as an internal server-side detail and stop exposing it through workflow page props and read DTOs.
  Rationale: the browser does not need filesystem paths to render workflow summaries, refresh workflow status, or stream logs. Redacting that field is the simplest way to restore the server boundary.
  Alternative considered: keep returning `repositoryPath` and rely on UI discipline not to use it. Rejected because the current failure path already shows that path-aware browser contracts are too leaky.

- Resolve repository context from route-safe identifiers before calling workflow storage.
  Rationale: pages and read endpoints can derive the repository from `{user, repo}` route params or repo-scoped identifiers, then translate that into an internal repository path immediately before service or storage access. This keeps storage lookups server-only while preserving the existing repo ownership checks.
  Alternative considered: continue validating browser-supplied absolute paths in `validateWorkflowRunListRequest`, `validateWorkflowRunDetailRequest`, and `validateWorkflowLogsRequest`. Rejected because it keeps raw filesystem paths in the public contract and leaves the browser coupled to backend storage layout.

- Split browser-facing workflow read shapes from internal storage records.
  Rationale: `WorkflowRunRecord` still needs `repositoryPath` for storage and repo-ownership checks, but browser-facing summaries and detail payloads should expose only repo-safe fields such as repository name, workflow id, branch, commit, status, timestamps, and error state.
  Alternative considered: reuse `WorkflowRunRecord` or the existing `WorkflowRunSummary` shape everywhere. Rejected because that keeps server-only fields in the external API and makes accidental regressions more likely.

- Migrate list, detail, and log reads together.
  Rationale: the workflow list page, detail page, detail polling, and live log stream all share the same repo context contract. Updating only one surface would leave the browser with mixed path-based and repo-scoped behavior.
  Alternative considered: fix only the initial page loader first. Rejected because the browser would still send `repositoryPath` during live refresh and the regression would remain.

- Preserve the existing live-update transport.
  Rationale: the approved scope is a server-boundary fix, not a transport redesign. The list page can keep polling, the detail page can keep polling plus log streaming, and only the repository-resolution boundary changes.
  Alternative considered: replace the log stream or status polling transport while touching the contract. Rejected because it adds unrelated risk without improving the server-boundary fix.

## Conventional Title

- Canonical request/PR title: `fix(workflows/storage): move workflow storage server-side`
- Conventional title metadata: `fix(workflows/storage)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [Partial contract migration] -> Update the list page, detail page, detail API, list API, and log stream contract in one change and cover them with regression tests.
- [Type churn around shared workflow DTOs] -> Introduce explicit browser-facing read DTOs or carefully narrow the existing shared types so internal storage records still retain repository paths.
- [False sense of fix from page-only changes] -> Verify that browser polling and log streaming also stop sending `repositoryPath`, not just the initial server render.
- [Unexpected consumers of path-based read endpoints] -> Check the current caller set during implementation and add a compatibility shim only if an internal caller still depends on the old contract.

## Migration Plan

- No persistent data migration is expected. The change is primarily a page/API contract and server-boundary refactor on top of the existing workflow-run storage.
- Update server components and read routes first so they can resolve repository context internally, then switch browser clients to the new repo-scoped contract, and finally remove path-based browser DTO fields.
- If implementation discovers an internal caller that still depends on path-based read endpoints, add a short-lived compatibility layer while migrating all in-repo callers in the same change.
- Rollback is low risk: restore the previous path-based read contract while leaving workflow-run storage and log files unchanged.

## Open Questions

- None.
