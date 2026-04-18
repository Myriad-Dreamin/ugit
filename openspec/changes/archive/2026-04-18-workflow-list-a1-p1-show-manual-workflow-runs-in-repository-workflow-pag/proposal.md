## Why

Manual workflow runs already persist `repository_name`, `repository_path`, and
`workflowId`, but repository workflow pages and their repo-scoped reads still
behave as if the path string is the authoritative identity. That makes
`ugit workflow logs <workflowId>` succeed while `/${user}/${repo}/workflows`
or its repo-scoped detail and log reads can miss the same run whenever the
stored path drifts from the repository path later resolved on the server.

The owner report matches that split exactly, so the safest fix is a narrow
read-identity change: keep repository isolation and the existing queue and
runner contracts, but make repo-scoped workflow reads use the stable stored
repository identity for manual runs.

## What Changes

- Introduce the
  `workflow-list-a1-p1-show-manual-workflow-runs-in-repository-workflow-pag`
  OpenSpec change for proposal "Show manual workflow runs in repository
  workflow pages".
- Add focused regressions that model a stored manual workflow run whose
  `repository_name` still matches the requested repository while the stored
  `repository_path` no longer matches the currently resolved path string.
- Add stable repo-scoped workflow storage read helpers keyed by stored
  `repository_name` for the repository workflow list, detail, and named log
  reads used by browser pages and repo-scoped REST endpoints.
- Route the existing workflow service, repo-scoped API, and browser read paths
  through those helpers without changing manual workflow queueing, scheduling,
  log persistence, or runner contracts.
- Preserve negative coverage for true cross-repository mismatches so the fix
  becomes less path-brittle without weakening repository isolation.

## Capabilities

### New Capabilities
- `workflow-list-a1-p1-show-manual-workflow-runs-in-repository-workflow-pag`:
  Stabilize repository workflow list, detail, and repo-scoped log reads for
  manual runs by matching the stored repository identity instead of a brittle
  path string, while keeping strict cross-repository rejection.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `fix(repo/workflows): show manual workflow runs`
- Conventional title metadata: `fix(repo/workflows)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Stabilize repo-scoped workflow run reads so manual runs
  queued through `ugit workflow run` reliably appear on repository workflow
  pages.
- Affected code areas: `lib/pr-runner/storage.ts`,
  `lib/workflow-runs/service.ts`, `lib/workflow-runs/validation.ts`,
  `app/api/workflows/runs/route.ts`,
  `app/api/workflows/runs/[workflowId]/route.ts`,
  `app/api/workflows/logs/route.ts`,
  `app/[user]/[repo]/workflows/page.tsx`,
  `app/[user]/[repo]/workflows/[workflowId]/page.tsx`, and focused Vitest
  coverage around workflow storage, service, API, and page reads
- Validation target after implementation: targeted Vitest coverage for
  workflow storage, service, API, and page regressions around repo identity,
  plus `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, and `pnpm build`
- Scope boundaries: no workflow queue or runner contract changes, no workflow
  list UI redesign, no repository alias system redesign, and no weakening of
  repository isolation for repo-scoped browser reads
- Risks and assumptions:
  - Existing workflow-run rows already persist `repository_name`, so the read
    fix should not require a data migration.
  - Repo-scoped reads must still resolve the requested repository on the
    server and return not found for true cross-repository mismatches.
  - Global workflow-id log reads that omit `repositoryName` remain part of the
    existing CLI contract and should stay unchanged.
