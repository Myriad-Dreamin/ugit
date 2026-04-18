## Why

Repository workflow runs can already be queued and streamed by `workflowId`,
but `/${user}/${repo}/workflows` can still render the empty state because the
repo-scoped list read path does not consistently use the same repository
identity that the queue, storage, and log paths use. The missing regression is
the full queue-to-list slice, so the safest fix is to reproduce that failure
and align the repo-scoped read chain without weakening repository ownership
checks or bypassing the REST boundary for browser workflow pages.

## What Changes

- Introduce the
  `workflow-list-a1-p1-fix-missing-repo-workflow-runs-on-the-list-page`
  OpenSpec change for proposal "Fix missing repo workflow runs on the list
  page".
- Add a regression that queues a workflow run for a repository and proves that
  the same run appears in the repo-scoped runs API and the
  `/${user}/${repo}/workflows` bootstrap and refresh flow.
- Align workflow-run repository identity handling across queue validation,
  storage, repo-scoped service and API reads, and page bootstrap and refresh so
  queued, running, and completed runs with existing logs stay visible on the
  repository workflow list.
- Preserve the browser-facing rule that workflow pages read through repo-scoped
  REST endpoints and do not import backend workflow services directly for those
  reads.
- Add focused coverage for touched storage, service, API, and page boundaries,
  including negative checks that another repository cannot enumerate or hydrate
  a different repository's workflow runs.

## Capabilities

### New Capabilities
- `workflow-list-a1-p1-fix-missing-repo-workflow-runs-on-the-list-page`:
  Ensure recorded workflow runs remain visible on repository workflow list
  reads across queueing, API bootstrap, and browser refresh while preserving
  repo-scoped isolation.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `fix(workflow/runs): Show repo workflow runs`
- Conventional title metadata: `fix(workflow/runs)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Reproduce the queue-to-list regression and fix the
  repo-scoped workflow read path so recorded workflow runs appear on the
  repository workflow list page.
- Affected code areas: `lib/workflow-runs/validation.ts`,
  `lib/pr-runner/storage.ts`, `lib/workflow-runs/service.ts`,
  `app/api/workflows/runs/route.ts`, `app/[user]/[repo]/workflows/page.tsx`,
  `app/[user]/[repo]/workflows/workflow-runs-list-client.tsx`, and focused
  Vitest coverage around workflow storage, service, API, and page reads
- Validation target after implementation: `pnpm fmt`, `pnpm fmt:check`,
  `pnpm lint`, targeted `pnpm test` coverage for the workflow read path, and
  `pnpm build`
- Scope boundaries: no browser-side workflow start, cancel, or retry controls;
  no global workflow dashboards; no log transport redesign beyond what is
  required to make existing runs visible on the repo list page
- Risks and assumptions:
  - The defect may sit in bootstrap or polling rather than storage alone, so
    the full repo-scoped read chain stays in scope.
  - Existing workflow-run rows and logs should remain reusable without a data
    migration.
  - Any fix must preserve repository ownership checks so one repository cannot
    enumerate another repository's workflow runs.
