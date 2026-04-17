## Context

The current workflow read slice is close to the right boundary, but it still
finishes the read path with raw repository filesystem paths:

- `app/[user]/[repo]/workflows/page.tsx` and
  `app/[user]/[repo]/workflows/[workflowId]/page.tsx` validate the configured
  owner and resolve the repository with `getRepositoryByName`, but then call
  workflow read services with `repository.path`.
- `app/api/workflows/runs`, `app/api/workflows/runs/[workflowId]`, and
  `app/api/workflows/logs` accept repo-scoped query params, resolve the
  repository on the server, and then immediately pass `repositoryPath` into the
  workflow read service layer.
- `lib/workflow-runs/service.ts` and `lib/workflow-runs/validation.ts` still
  model read requests around `repositoryPath`, so SQLite-backed reads in
  `lib/pr-runner/storage.ts` are selected through path-based payloads inside the
  workflow route slice.
- The browser-facing workflow DTOs are already close to repo-safe, but the
  internal read contract is still path-driven and remains the most likely
  source of the reported workflow page failure.

The repository already contains an archived workflow server-boundary change with
the same architectural direction. This proposal should follow that intent while
updating the metadata and scope to the assigned planner change. Full end-to-end
validation is also constrained by a missing local `better-sqlite3` native
binding in this checkout, so the eventual implementation should keep the refactor
focused on workflow reads and rely on targeted tests where possible.

## Goals / Non-Goals

**Goals:**
- Resolve repository context inside server components, route handlers, or other
  server-only helpers before any workflow list, detail, or log read reaches
  SQLite-backed storage.
- Remove path-based workflow read payloads from the browser-facing workflow
  route slice while keeping `repositoryPath` available as an internal storage
  detail on the server.
- Preserve current workflow list polling, detail polling, log streaming, repo
  mismatch handling, and not-found behavior.
- Keep the implementation aligned with the existing archived workflow
  server-boundary direction instead of introducing a second architecture.
- Add regression tests for workflow pages and the affected workflow read APIs.
- Preserve the canonical request/PR title
  `fix(workflows/storage): move workflow reads server-side` and conventional
  title metadata `fix(workflows/storage)` throughout the materialized artifacts.

**Non-Goals:**
- Change workflow queueing, scheduler behavior, or unrelated pull-request
  runner flows.
- Introduce new workflow storage tables, schema changes, or migrations unless a
  confirmed defect blocks the boundary fix.
- Redesign the workflow UI, change refresh cadence, or replace the current log
  streaming transport.
- Expand the change into a broader PR runner or storage-layer cleanup outside
  workflow reads.

## Decisions

- Resolve repository context from repo-scoped identifiers immediately before the
  workflow read service touches storage.
  Rationale: pages and route handlers already know `{user, repo}` or
  `repositoryName`, so they can keep the external contract repo-scoped and
  translate to an internal repository record only on the server.
  Alternative considered: keep path-based validation requests and rely on
  `resolveWorkflowReadRepository` as a thin shim. Rejected because it still
  treats raw filesystem paths as part of the workflow read contract.

- Introduce or reuse repo-scoped server read entry points for workflow list,
  detail, and log flows.
  Rationale: the page loaders, JSON endpoints, and log stream should share one
  repo-safe way to select workflow storage so list, detail, and log reads do
  not drift.
  Alternative considered: patch only the list page or only the failing service
  call. Rejected because mixed path-based and repo-scoped behavior would leave
  polling or log streaming on the old boundary.

- Keep `repositoryPath` as an internal storage detail and do not return or
  require it in browser-facing workflow reads.
  Rationale: SQLite and log lookups still need the resolved repository path, but
  the browser only needs repository name, workflow id, and workflow status
  fields.
  Alternative considered: expose both `repositoryName` and `repositoryPath` for
  compatibility. Rejected because that keeps the server boundary leaky and makes
  regressions harder to detect.

- Migrate workflow list refresh, detail refresh, and live log streaming
  together.
  Rationale: those flows share the same repository-selection contract, and the
  user-visible fix is incomplete if any one of them still depends on a
  path-based read payload.
  Alternative considered: fix initial page renders first and defer the live
  paths. Rejected because the browser would still cross the same boundary during
  polling or log reads.

- Preserve the existing live-update transport.
  Rationale: the approved scope is a server-boundary fix, not a transport
  redesign. Polling and the current plain-text log stream already provide the
  required behavior.
  Alternative considered: replace polling or log streaming while touching the
  contract. Rejected because it expands scope without helping the reported
  failure.

## Conventional Title

- Canonical request/PR title: `fix(workflows/storage): move workflow reads server-side`
- Conventional title metadata: `fix(workflows/storage)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [Partial contract migration] -> Update workflow pages, list and detail APIs,
  log reads, and the shared read service together so no live path still depends
  on `repositoryPath`.
- [Read-shape churn] -> Keep explicit browser-facing read DTOs and treat
  `repositoryPath` as an internal-only field to avoid accidental re-exposure.
- [Validation gaps from local SQLite issues] -> Prefer targeted workflow tests
  and keep `pnpm build` conditional on a usable local `better-sqlite3` binding.
- [Drift from archived boundary intent] -> Reuse the earlier server-boundary
  direction and terminology so the code change does not introduce a competing
  workflow read architecture.

## Migration Plan

- No persistent data migration is expected. The change is a workflow page, API,
  and service-boundary refactor on top of the existing workflow-run storage and
  log files.
- Update server read entry points first so they accept repo-scoped identifiers,
  then switch the list, detail, and log routes to the new contract, and finally
  remove the remaining path-based read validation from browser-facing flows.
- If implementation uncovers an internal in-repo caller that still requires a
  path-based read helper, keep that helper server-only and migrate the caller in
  the same change.
- Rollback is low risk: restore the earlier internal read contract while
  leaving workflow-run storage and log files unchanged.

## Open Questions

- None.
