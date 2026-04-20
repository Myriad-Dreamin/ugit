## Why

Repository pages currently stop at `/${user}/${repo}`, while pull-request data is only exposed through path-based CLI and server contracts plus runner-side storage. Repo-scoped pull-request pages are needed so humans can list PRs for a repository, inspect one PR's activity and CI or workflow history, and jump to the delegated GitHub view without exposing raw filesystem paths to the browser.

This work is timely because the repository routes, workflow-page REST bootstrap pattern, PR runner storage, and CI result artifacts already exist. The missing slice is one browser-safe read model that resolves repositories by name, shapes PR detail data for the UI, and degrades gracefully when GitHub metadata is incomplete.

## What Changes

- Introduce the `repo-pr-pages-a1-p1-add-repository-pr-pages` OpenSpec change for proposal "Add repository PR pages".
- Add `/${user}/${repo}/pull-requests` and `/${user}/${repo}/pull-requests/[pullRequestId]`, plus repository-page navigation so the PR UI is discoverable alongside workflow runs.
- Extend shared pull-request contracts, storage, and services with browser-safe repo-scoped list/detail DTOs, CI or workflow history shaping from result artifacts, and a pull-request activity timeline.
- Add repo-scoped GET pull-request REST reads and same-origin REST bootstrap helpers for the new pages while preserving the existing CLI-facing repository-path list and edit behavior.
- Add best-effort GitHub delegation metadata and an `Open on GitHub` action with compare/create or unavailable fallback states, plus focused Vitest coverage and the standard `pnpm` validation contract.

## Capabilities

### New Capabilities
- `repo-pr-pages-a1-p1-add-repository-pr-pages`: Add repo-scoped pull-request list and detail pages, browser-safe read models, PR activity and CI/workflow history, GitHub delegation links, repository navigation, and focused validation.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `feat(pr-pages): surface repository PR pages`
- Conventional title metadata: `feat(pr-pages)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Add one repo PR browser slice with a list page, detail page, repo-scoped REST reads, activity and CI history, and GitHub delegation links.
- Existing code areas extended: `app/[user]/[repo]`, `app/api/pull-requests*`, `lib/pr-runner/*`, `lib/owner.ts`, `packages/ugit-cli/src/pull-request-contract.ts`, and new PR REST helper modules parallel to `lib/workflow-runs/*`
- Validation contract: `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, targeted `pnpm test` coverage for PR pages/read models/routes, and `pnpm build`
- Scope boundaries: no browser-side PR create/edit/sync/merge controls, no global cross-repository PR dashboard, no GitHub comments/reviews/status-check sync, and no authenticated GitHub API integration in this first cut
- Key assumptions and risks:
  - PR-triggered workflow history comes from PR CI jobs and their `.data/ci-results/<repo>/<branch>.json` artifacts, not unrelated manual workflow runs.
  - Current PR storage is summary-oriented, so accurate activity history may require a new forward-only event table for future transitions.
  - Canonical GitHub PR URLs may be unavailable without extra metadata, so the GitHub card must stay best-effort and resilient.
