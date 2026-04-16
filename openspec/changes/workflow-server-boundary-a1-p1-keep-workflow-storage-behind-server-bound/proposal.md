## Why

The workflow list and detail pages currently resolve a repository on the server, but they pass the resolved `repositoryPath` into browser props, browser polling requests, and shared workflow DTOs. That leaks backend filesystem paths across the server boundary and keeps SQLite-backed workflow reads coupled to client-supplied path input, which matches the failing workflow route slice and makes the workflow UI harder to keep server-only.

This fix keeps the current workflow monitoring UX but moves repository resolution and storage entry selection fully behind server loaders or route handlers. The browser should only work with repo-scoped route context and workflow ids, while SQLite-backed reads continue to happen only inside server code.

## What Changes

- Introduce the `workflow-server-boundary-a1-p1-keep-workflow-storage-behind-server-bound` OpenSpec change for proposal "Keep workflow storage behind server boundaries".
- Refactor the workflow list and detail pages so repository lookup happens on the server and raw repository filesystem paths are no longer passed into client components or browser polling requests.
- Update the workflow list, detail, and log read contracts so they resolve repository context on the server before touching SQLite-backed workflow storage, while preserving current repo-mismatch and not-found behavior.
- Redact backend-only repository path fields from browser-facing workflow read DTOs while keeping the existing workflow summary, detail, polling, and live log behavior intact.
- Add regression coverage for the workflow page render contract and the affected workflow read APIs so the failing server-boundary route behavior does not return.

## Capabilities

### New Capabilities
- `workflow-server-boundary-a1-p1-keep-workflow-storage-behind-server-bound`: Keep workflow list, detail, and log reads behind server-resolved repository boundaries without exposing raw repository filesystem paths to the browser.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `fix(workflows/storage): move workflow storage server-side`
- Conventional title metadata: `fix(workflows/storage)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Implement one workflow UI/server-boundary fix so SQLite-backed workflow reads stay behind backend loaders/APIs and the browser no longer depends on raw repository paths.
- Affected code areas: `app/[user]/[repo]/workflows/*`, `app/api/workflows/*`, `lib/workflow-runs/*`, `lib/pr-runner/storage.ts`, and any shared workflow read contract types used by the browser.
- Validation contract: `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, targeted `pnpm test`, and `pnpm build` when feasible.
- Scope boundaries: no pull-request API refactors outside workflow routes, no workflow storage schema changes unless a confirmed defect requires them, and no new workflow features or UI redesign.
- Risks and assumptions:
  - The boundary issue is confirmed, but the exact failing entry point still needs reproduction during implementation so the coder can keep the fix narrow.
  - List polling, detail polling, and log streaming share the same repository context contract, so partial migration is likely to break live updates.
