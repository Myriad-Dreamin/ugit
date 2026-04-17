## Why

The workflow route slice already starts from repo-scoped URLs, but the list and
detail pages, workflow read services, validation helpers, and read APIs still
translate that route context into raw `repositoryPath` inputs before touching
SQLite-backed workflow storage. That keeps workflow reads coupled to backend
filesystem paths inside the page or API boundary and matches the reported
`createDatabase` failure path.

This change keeps the current workflow monitoring UX, but it moves repository
resolution and workflow storage entry selection fully behind server-only repo
resolution. Browser-facing workflow reads should work from repo-scoped
identifiers and workflow ids only, while `repositoryPath` remains an internal
storage detail on the server.

## What Changes

- Introduce the
  `workflow-server-boundary-a1-p1-move-workflow-reads-behind-server-only-re`
  OpenSpec change for proposal "Move workflow reads behind server-only repo
  resolution".
- Refactor the repository workflow list and detail pages so repo context is
  resolved on the server from route-safe identifiers before any SQLite-backed
  workflow read occurs.
- Update workflow list, detail, and log read services, validation, and API
  entry points so browser-facing flows no longer depend on path-based workflow
  read payloads.
- Keep `repositoryPath` as an internal server-side storage detail only, while
  preserving the current workflow list polling, detail polling, and live log
  streaming behavior.
- Add regression coverage for workflow pages and workflow read APIs so repo
  mismatches, not-found behavior, and browser-visible path leaks do not return.

## Capabilities

### New Capabilities
- `workflow-server-boundary-a1-p1-move-workflow-reads-behind-server-only-re`:
  Keep workflow list, detail, and log reads behind server-only repo resolution
  so browser-facing workflow reads stay repo-scoped and never require raw
  repository filesystem paths.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `fix(workflows/storage): move workflow reads server-side`
- Conventional title metadata: `fix(workflows/storage)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Refactor workflow list, detail, and log reads so repository
  context is resolved server-side before SQLite access, while preserving live
  monitoring behavior and adding regression coverage.
- Affected code areas: `app/[user]/[repo]/workflows/*`,
  `app/api/workflows/*`, `lib/workflow-runs/*`,
  `lib/pr-runner/storage.ts`, and any shared workflow read contracts used by
  repo workflow pages.
- Validation target after implementation: `pnpm fmt`, `pnpm fmt:check`,
  `pnpm lint`, targeted workflow page and API tests, and `pnpm build` when the
  local `better-sqlite3` binding is usable.
- Scope boundaries: no workflow schema changes, no queueing or scheduler
  changes, no pull-request runner refactor outside workflow reads, and no UI
  redesign.
- Risks and assumptions:
  - List refresh, detail refresh, and live log streaming share the same repo
    resolution contract, so they should move together.
  - There is already an archived workflow server-boundary change in this repo;
    implementation should follow that direction instead of inventing a new read
    architecture.
  - Local reproduction is noisy in this checkout because `better-sqlite3` is
    not currently usable, so the eventual code change should keep validation
    narrow and targeted.
