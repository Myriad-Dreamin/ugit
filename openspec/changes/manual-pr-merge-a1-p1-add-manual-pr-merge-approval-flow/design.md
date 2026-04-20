## Context

`ugit` already has most of the local pull-request and browser infrastructure
that this change needs:

- `lib/pr-runner/runner.ts` currently executes CI workflows and then calls
  `attemptFastForwardMerge` immediately after successful workflows.
- `lib/pr-runner/storage.ts` already exposes pull-request status `passed`, but
  `completeCiJob` still maps a successful latest CI job to pull-request status
  `merged`, which collapses "green" and "approved" into the same terminal
  state.
- `lib/pr-runner/service.ts`, `app/api/pull-requests/[pullRequestId]/route.ts`,
  and `app/[user]/[repo]/pull-requests/[pullRequestId]/page.tsx` already serve
  repo-scoped detail reads through a same-origin REST bootstrap and client
  refresh loop that must remain the browser boundary.
- `lib/pull-requests/github.ts` can currently derive only best-effort GitHub
  compare links from local git remotes; there is no authenticated GitHub API
  client or canonical PR lookup yet.
- `lib/pr-runner/merge.ts` assumes a successful PR merge means advancing the
  mirrored local base branch directly to the PR head commit, but a GitHub
  squash merge creates a new base-branch commit that the mirror must fetch and
  adopt instead.

The change therefore spans storage, CI lifecycle mapping, GitHub integration,
repo-scoped API contracts, PR detail UI state, and mirrored-repository branch
management. It should stay one proposal because partial implementation would
leave an inconsistent PR lifecycle that coding lanes could not validate
meaningfully.

## Goals / Non-Goals

**Goals:**
- Leave a pull request open in status `passed` after its latest CI job
  succeeds, and reserve status `merged` for explicit merge approval.
- Derive merge readiness on the server from three live checks: latest CI
  success for the current head commit, mirrored-base parity with the selected
  GitHub remote base branch, and GitHub pull-request mergeability.
- Add a server-only GitHub integration path with one documented credential
  entry point so the server can resolve the canonical PR, read mergeability,
  perform a squash merge, and fetch the new base commit from GitHub.
- Add a repo-scoped merge service and route,
  `POST /api/pull-requests/[pullRequestId]/merge?repositoryName=<repo>`, that
  revalidates readiness, blocks non-fast-forward branches with a rebase error,
  executes the GitHub merge, updates the mirrored base branch, and persists
  merged-state activity.
- Extend the repository PR detail page with a readiness checklist, merge
  button, in-flight feedback, success or failure messaging, and repo-scoped
  refresh behavior that never bypasses the existing REST boundary.
- Add focused Vitest coverage plus README documentation for the approval flow,
  merge error cases, and GitHub credential setup.

**Non-Goals:**
- Add GitHub review, comment, or status-check synchronization beyond the data
  required for mergeability checks and squash merge execution.
- Implement automatic rebase, conflict resolution, merge queues, or alternate
  merge strategies such as merge commits or rebase merges.
- Move the approval flow into the CLI or any browser path that talks directly
  to GitHub instead of the repo-scoped ugit server APIs.
- Redesign the existing repository PR list or detail information architecture
  beyond the readiness and merge controls required for approval.

## Decisions

- Separate CI completion from merge execution and compute readiness on demand.
  Rationale: CI success, GitHub mergeability, and mirrored-base parity can all
  change after a job finishes, so persisting a long-lived "ready" flag would go
  stale. The runner should stop after workflow execution, store the latest job
  result, and leave merge execution to an explicit user-triggered service call.
  Alternative considered: keep merge inside the runner and gate it on a stored
  approval flag. Rejected because it still couples approval to background job
  timing, obscures user feedback, and makes stale approval state harder to
  reason about.

- Treat pull-request status `passed` as the terminal pre-merge state and keep
  `merged` exclusive to successful approval-backed merges.
  Rationale: the user-visible lifecycle needs a durable distinction between
  "CI is green" and "the repository has merged this PR." Storage, read models,
  legacy activity reconstruction, and browser status presentation should all use
  that distinction.
  Alternative considered: keep status `merged` for green CI and add a separate
  boolean approval field. Rejected because it would leave the primary PR state
  misleading and make open-vs-merged filtering inconsistent.

- Extend the server-only GitHub helper into an authenticated API client that
  reuses local remote discovery and one documented token configuration path,
  such as `UGIT_GITHUB_TOKEN`.
  Rationale: the server already knows the repository path and preferred remote,
  so it can resolve GitHub owner or repository coordinates from git config and
  keep credentials out of browser payloads. One explicit token path is simpler
  to document and test than a more ambitious auth model.
  Alternative considered: require users to merge directly on GitHub and only
  surface compare links in ugit. Rejected because the request explicitly wants
  a repo-scoped merge button that executes the merge through ugit.
  Alternative considered: call GitHub from the browser. Rejected because it
  would leak credentials, break same-origin repository boundaries, and violate
  the repo-scoped REST design.

- Split the current fast-forward merge helper into two responsibilities:
  ancestry preflight for the PR head commit and mirrored-base update after the
  GitHub squash merge.
  Rationale: before approval, ugit only needs to confirm that the mirrored
  local base branch is still an ancestor of the PR head commit so the branch
  can be rebased cleanly if needed. After GitHub creates a squash commit, ugit
  must instead fetch the GitHub base branch and advance the mirrored base ref
  to that fetched commit while preserving the managed-worktree eviction rules
  from `workflow-worktree-cache`.
  Alternative considered: extend `attemptFastForwardMerge` with mode flags.
  Rejected because it hides two different invariants behind one API and keeps
  the old "merge to head commit" mental model in place after the repository has
  switched to GitHub-owned squash commits.

- Revalidate readiness inside the merge action and bind it to the latest
  successful job plus current PR head commit.
  Rationale: the UI readiness card is advisory. The merge endpoint must defend
  against stale page data, newer PR synchronizations, changed GitHub
  mergeability, or base-branch drift by recomputing readiness and confirming
  the latest successful job still matches the stored head commit.
  Alternative considered: trust the client-sent readiness state. Rejected
  because stale clients could merge the wrong commit or act on outdated
  GitHub state.

- Return structured merge outcomes that distinguish success, not-ready,
  rebase-required, and unexpected server failures.
  Rationale: the PR detail UI needs different behavior for a disabled control,
  a mergeability-pending state, a user-fixable rebase failure, and an internal
  error. A structured response also keeps route tests and service behavior
  explicit.
  Alternative considered: return only generic HTTP failures with unstructured
  strings. Rejected because it would force the UI to guess which errors are
  actionable and which require a retry or operator intervention.

## Conventional Title

- Canonical request/PR title: `feat(pr/merge): require manual PR merge approval`
- Conventional title metadata: `feat(pr/merge)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [GitHub mergeability is eventually consistent] -> Treat `mergeable: null` as
  a pending blocked state, surface that explicitly in the readiness checklist,
  and require a later refresh instead of guessing mergeability.
- [Authenticated GitHub access adds operator setup burden] -> Keep the
  credential model to one documented server-side token path, fail closed when
  it is missing, and add README guidance for required scopes.
- [The mirror can drift between a page read and merge click] -> Recompute
  latest-job freshness, GitHub base parity, mergeability, and fast-forward
  ancestry inside the merge service before mutating anything.
- [GitHub squash merge changes the commit that local base should track] ->
  fetch the GitHub base branch again after the merge and update the mirrored
  base branch to that fetched commit instead of the PR head commit.
- [Managed workflow worktree residue can still block a base-ref update] ->
  reuse or extend the existing managed-worktree eviction logic before advancing
  the mirrored base branch to the fetched GitHub commit.
- [GitHub merge could succeed before local mirror repair completes] -> keep the
  post-merge reset step in the same server flow, return a clear error if the
  mirror update fails, and ensure the failure path is test-covered so it does
  not silently leave the repository inconsistent.

## Migration Plan

- Extend the pull-request contract types and server read models with merge
  readiness data, merge action responses, and any additional GitHub metadata
  needed by the repo-scoped PR detail route.
- Update CI job completion so successful latest jobs persist pull-request
  status `passed`, reserve `merged` for explicit approval, and keep existing
  queued or running polling behavior intact.
- Add the server-only GitHub client and token configuration path, then wire it
  into repo-scoped detail reads and the new merge service and route.
- Replace the existing "move base to PR head" merge helper with an ancestry
  preflight step plus a post-squash mirrored-base update step that fetches the
  GitHub base branch before mutating refs.
- Add PR detail UI controls and focused tests, then update `README.md` with the
  approval flow, GitHub token requirement, and rebase-on-failure guidance.
- Rollback remains straightforward before rollout: remove the merge action and
  readiness UI, restore post-CI merge behavior, and leave the added GitHub
  client dormant if needed.

## Open Questions

- None. If later requests need merge queues, GitHub review state, or CLI-driven
  approvals, those should land as follow-up changes instead of widening this
  first manual-approval slice.
