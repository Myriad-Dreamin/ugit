## Context

`queueWorkflowRun` already persists both `repository_name` and
`repository_path` for each manual workflow run. The repo-scoped read path,
however, still resolves the requested repository name to a current server path
and then queries workflow storage by `repository_path`. In
`lib/pr-runner/storage.ts`, `listWorkflowRuns` and
`readWorkflowRunForRepository` both filter on `workflow_runs.repository_path`,
and `lib/workflow-runs/service.ts` routes repository workflow list, detail,
and named log reads through those helpers.

That split explains the owner report. A manual run can still be discovered by
global `workflowId`, which is why `ugit workflow logs <workflowId>` works, but
the repository workflow pages can miss the same run if the stored
`repository_path` no longer matches the path string later resolved for the
same repository name. Path aliasing, normalization drift, or repository-root
relocation can all create that mismatch even when the repository identity is
otherwise unchanged.

The page and API layers already have the right overall shape for a narrow fix:
browser-facing reads stay repo-scoped and server validated, while the storage
layer already stores the stable repository name we need. The implementation
should therefore stay centered on read helpers and regressions, without
changing the queue, runner, or UI contracts.

The artifacts for this change must preserve the canonical request/PR title
`fix(repo/workflows): show manual workflow runs` and conventional-title
metadata `fix(repo/workflows)` while execution remains blocked pending human
approval.

## Goals / Non-Goals

**Goals:**
- Make `/${user}/${repo}/workflows` and its repo-scoped detail and log reads
  return manual workflow runs when the stored `repository_name` matches the
  resolved repository, even if the stored path string has drifted.
- Keep repo-scoped workflow reads strict so a workflow run stored for one
  repository cannot be read from another repository route.
- Reuse the existing persisted workflow-run identity fields and avoid changing
  the queue, runner, CLI, or log-storage write contracts.
- Add focused regressions across workflow storage, service, API, and page
  layers for both path-drift recovery and true cross-repository rejection.

**Non-Goals:**
- Redesign the workflow list or detail UI.
- Change manual workflow queueing, scheduling, execution, or log persistence.
- Introduce a broader repository alias or path-canonicalization system.
- Remove the existing workflow-id-only log-read contract used by
  `ugit workflow logs` when no repository name is supplied.

## Decisions

- Read repo-scoped workflow runs by stored `repository_name`, not by stored
  `repository_path`.
  Rationale: the reported failure is a repository-identity mismatch on reads,
  and `repository_name` is already persisted as the stable server-side
  identity that matches the repo-scoped browser contract.
  Alternative considered: normalize or `realpath` both path strings before
  comparing them. Rejected because it stays path-brittle, depends on local
  filesystem behavior, and does not help existing rows whose stored path no
  longer matches the current repo root.
  Alternative considered: add a repository-alias mapping layer. Rejected
  because it is broader than the defect and unnecessary when the table already
  stores the repository name.

- Keep repository resolution and authorization at the service boundary, then
  use the resolved repository name as the storage read key.
  Rationale: repo-scoped browser reads should still prove that the named
  repository exists under the configured server root before any workflow data
  is returned.
  Alternative considered: let browser reads query by `workflowId` alone.
  Rejected because it weakens repository isolation and would make cross-repo
  detail and log URLs unsafe.

- Route the existing list, detail, and named log read paths through shared
  name-keyed helpers without changing queue or runner writes.
  Rationale: the queue path already records the data we need, and changing
  only the read helpers keeps the fix narrow and approval-safe.
  Alternative considered: rewrite existing rows or change CLI payloads to
  store a different path representation. Rejected because the existing
  `repository_name` field is sufficient and the defect is on the read side.

- Preserve workflow-id-only log reads when `repositoryName` is omitted.
  Rationale: `ugit workflow logs <workflowId>` relies on the global workflow-id
  contract today, and the planner guidance says not to change queue or runner
  behavior while fixing browser repo reads.
  Alternative considered: require repository name for every log read. Rejected
  because it would break current CLI behavior and expands scope beyond the
  browser-facing defect.

- Add focused regressions at the storage, service, API, and page layers.
  Rationale: the failure spans a helper boundary, so coverage should prove the
  stable repo identity holds from SQL queries up through repo-scoped browser
  reads.
  Alternative considered: add only a service or page test. Rejected because it
  would leave the actual storage selector drift under-specified.

## Conventional Title

- Canonical request/PR title: `fix(repo/workflows): show manual workflow runs`
- Conventional title metadata: `fix(repo/workflows)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [Repository name becomes the repo-scoped storage key] -> Keep server-side
  repository resolution ahead of the read and preserve explicit cross-repo
  rejection tests so the name-based lookup does not broaden access.
- [Rows may still contain stale or aliased paths] -> Accept stale paths for
  read filtering because runner and log operations still use the stored record;
  the proposal only removes path brittleness from repo-scoped reads.
- [A narrow read fix could miss one entry point] -> Route list, detail, and
  named log reads through shared helpers and cover each surface with targeted
  regressions.
- [Validation can drift toward only happy paths] -> Add explicit tests for
  path-alias or repository-root drift mismatches and for true cross-repository
  rejection.

## Migration Plan

- No persistent data migration is expected. Existing workflow-run rows already
  persist `repository_name`, so the change can reuse stored data.
- Update the repo-scoped workflow storage helpers and service call sites to
  use the resolved repository name for list, detail, and named log reads while
  leaving workflow-id-only log reads unchanged.
- Add targeted regressions around path drift, repo-scoped list visibility,
  repo-scoped detail and log reads, and true cross-repository rejection.
- Validate the implementation with focused Vitest coverage, `pnpm fmt`,
  `pnpm fmt:check`, `pnpm lint`, and `pnpm build`.
- Rollback is straightforward: restore the old path-keyed helpers and remove
  the new repo-identity regressions.

## Open Questions

- None.
