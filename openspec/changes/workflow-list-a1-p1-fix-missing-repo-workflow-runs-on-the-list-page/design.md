## Context

Repository workflow pages already follow the intended shape:
`app/[user]/[repo]/workflows/page.tsx` bootstraps through
`GET /api/workflows/runs`, `workflow-runs-list-client.tsx` keeps polling that
repo-scoped endpoint, and `lib/workflow-runs/service.ts` resolves repository
context before delegating to `lib/pr-runner/storage.ts`. The queue path also
already writes repository metadata and initializes a log file, which is why a
workflow run can have logs even when the repository workflow list still says no
runs were recorded.

The missing confidence is the full queue-to-list path. Existing tests cover
queueing, repo-scoped reads, and page wiring in isolation, but they do not
prove that a workflow run queued for a repository survives validation, storage,
repo-scoped API reads, and list-page bootstrap and refresh as one vertical
slice. This change therefore stays focused on aligning repository identity
across that chain and locking it in with regressions.

The artifacts for this change must preserve the canonical request/PR title
`fix(workflow/runs): Show repo workflow runs` and conventional-title metadata
`fix(workflow/runs)` while keeping the approved change path unchanged.

## Goals / Non-Goals

**Goals:**
- Reproduce the reported queue-to-list regression with a test that queues a
  workflow run for a repository and proves it appears in repo-scoped list reads
  and the repository workflow page bootstrap.
- Align workflow-run repository identity handling across queue validation,
  storage, repo-scoped service and API reads, and list-page refresh so runs
  that already have logs remain visible to the owning repository.
- Preserve repo-scoped REST reads for browser workflow pages and keep strict
  cross-repository rejection.
- Add focused regressions for touched storage, service, API, and page
  boundaries.

**Non-Goals:**
- Add workflow start, cancel, retry, or other new browser controls.
- Redesign the workflow list UI or create a global workflow dashboard.
- Redesign log transport beyond what is needed for repo-scoped run visibility.
- Relax repository ownership checks or reintroduce direct backend workflow
  service reads into browser-facing pages.

## Decisions

- Add a regression for the queue-to-list vertical slice instead of only unit
  coverage around a helper.
  Rationale: the report is specifically that queueing and log streaming work
  while the repository list stays empty, so the fix needs a test that spans the
  same boundaries the user hits.
  Alternative considered: rely only on storage or service tests. Rejected
  because those do not prove the page bootstrap and refresh path stays aligned
  with queued workflow records.

- Use the same stable repo-scoped repository identity across validation,
  storage, and repo-scoped reads while keeping repository paths as internal
  execution data.
  Rationale: the failure is most likely caused by a mismatch between how the
  queue path records repository identity and how the repo-scoped list path
  later looks that run up. Matching the server-resolved repository name keeps
  the browser contract aligned with stored workflow ownership without exposing
  raw paths.
  Alternative considered: fix only the list page bootstrap. Rejected because
  polling and other repo-scoped read entry points would still be able to drift
  from the queue path.
  Alternative considered: key browser reads by workflow id alone. Rejected
  because it weakens repo-scoped isolation.

- Keep browser-facing workflow list reads behind repo-scoped REST endpoints for
  both bootstrap and refresh.
  Rationale: `AGENTS.md` requires browser workflow pages to read through
  repo-scoped REST endpoints rather than importing backend workflow services
  directly, and the existing page and client structure already supports that
  boundary.
  Alternative considered: move the list page back to direct server-service
  reads for bootstrap. Rejected because it violates repo guidance and creates a
  different code path from live refresh.

- Add targeted regression coverage at each touched boundary: storage, service,
  API, and page.
  Rationale: the implementation spans those modules, and explicit coverage for
  queued, running, and completed visibility plus cross-repository rejection is
  the clearest way to prevent regressions.
  Alternative considered: rely on end-to-end behavior only. Rejected because
  it would make the repository identity contract harder to diagnose when it
  breaks.

## Conventional Title

- Canonical request/PR title: `fix(workflow/runs): Show repo workflow runs`
- Conventional title metadata: `fix(workflow/runs)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [The root cause may sit in more than one boundary] -> Keep validation,
  storage, service, API, and page bootstrap and refresh in scope for this one
  change.
- [Repository identity fixes could broaden visibility] -> Preserve explicit
  repo ownership checks and negative tests for cross-repository reads.
- [A narrow bootstrap fix could leave live refresh inconsistent] -> Keep the
  page bootstrap and client polling paths on the same repo-scoped REST contract.
- [Coverage could overfit to only completed runs] -> Add regression cases that
  cover queued, running, and completed runs that already have logs.

## Migration Plan

- No persistent data migration is expected. Existing workflow-run rows and log
  files should remain valid once repo-scoped reads use the aligned repository
  identity.
- Add the queue-to-list regression first so the behavior is reproducible before
  changing the read path.
- Update the affected validation, storage, service, API, and page bootstrap or
  refresh code to use the same repo-scoped repository identity for list reads
  while keeping ownership validation strict.
- Validate the implementation with focused workflow-read tests plus
  `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, and `pnpm build`.
- Rollback is straightforward: restore the previous read-path logic and remove
  the new queue-to-list regressions.

## Open Questions

- None.
