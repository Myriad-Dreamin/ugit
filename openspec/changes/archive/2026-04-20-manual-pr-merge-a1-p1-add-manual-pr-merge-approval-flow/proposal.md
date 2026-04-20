## Why

Successful pull requests currently jump straight from green CI to a local
fast-forward merge, which removes the human approval step and marks the pull
request as `merged` before anyone can review the final readiness conditions.
That behavior also assumes the mirrored local base branch is still equivalent
to the GitHub base branch, even though the repository PR pages change
explicitly left browser merge controls and authenticated GitHub lookups for a
follow-up proposal.

This change is needed now because the desired merge flow is no longer "move the
mirrored base branch to the PR head commit." The approved action is a GitHub
squash merge followed by resetting the mirrored local base branch to the latest
GitHub base commit, so readiness must become explicit and the merge must move
behind a user-triggered approval step.

## What Changes

- Introduce the
  `manual-pr-merge-a1-p1-add-manual-pr-merge-approval-flow` OpenSpec change
  for proposal "Add manual PR merge approval flow".
- Stop automatic post-CI fast-forward merges so the latest successful pull
  request stays open in status `passed` until a human explicitly approves a
  merge.
- Add server-derived merge-readiness evaluation that requires the latest local
  CI job to have succeeded for the current head commit, the mirrored local base
  branch to match the selected GitHub remote base branch, and the GitHub pull
  request to report mergeable status.
- Introduce a server-only GitHub integration path that resolves the canonical
  pull request, reads mergeability and base or head commit state, performs a
  squash merge, and fetches the latest GitHub base commit without exposing
  credentials or GitHub API calls to the browser.
- Add a repo-scoped merge action endpoint and a repository pull-request detail
  UI merge card that shows readiness, keeps the existing same-origin REST
  boundary, and returns a clear rebase-required error when the branch can no
  longer fast-forward from the mirrored base branch.
- After approval, perform the GitHub squash merge, reset the mirrored local
  base branch to the latest GitHub base commit, persist merged-state activity,
  and add focused tests plus README documentation for the new approval flow and
  GitHub credentials.

## Capabilities

### New Capabilities
- `manual-pr-merge-a1-p1-add-manual-pr-merge-approval-flow`: Replace automatic
  post-CI PR merges with an explicit approval flow that computes merge
  readiness, exposes a repo-scoped merge action, performs GitHub squash merges,
  and realigns the mirrored base branch with GitHub after approval.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title: `feat(pr/merge): require manual PR merge approval`
- Conventional title metadata: `feat(pr/merge)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Convert green pull requests into manually approved
  GitHub-backed merges with explicit readiness checks, a repo-scoped merge API,
  repository PR detail merge controls, and mirrored-base reset after squash
  merge.
- Existing code areas extended: `lib/pr-runner/runner.ts`,
  `lib/pr-runner/storage.ts`, `lib/pr-runner/service.ts`,
  `lib/pr-runner/merge.ts`, `lib/pr-runner/worktrees.ts`,
  `lib/pull-requests/github.ts`, `lib/pull-requests/presentation.ts`,
  `app/api/pull-requests/[pullRequestId]/route.ts`, new
  `app/api/pull-requests/[pullRequestId]/merge/route.ts`,
  `app/[user]/[repo]/pull-requests/[pullRequestId]/*`,
  `packages/ugit-cli/src/pull-request-contract.ts`, `README.md`, and focused
  Vitest coverage around readiness evaluation, GitHub merge behavior, storage,
  routes, and UI states
- Validation contract: `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, targeted
  `pnpm test` coverage for the manual merge flow, and `pnpm build`
- Scope boundaries: no GitHub review, comment, or status-check synchronization
  beyond mergeability plus squash merge; no automatic rebase or conflict
  resolution; no non-fast-forward merge strategy; no browser bypass of the
  repo-scoped REST boundary
- Key assumptions and risks:
  - A server-side GitHub credential path must be introduced and documented
    because the repository currently has no authenticated GitHub API
    integration.
  - GitHub `mergeable` can be temporarily unknown, so readiness must surface a
    pending or blocked state instead of guessing.
  - The mirrored-base parity check must fetch the selected GitHub base branch
    before comparing commits or it will misreport readiness from stale refs.
  - If a branch is no longer fast-forwardable from the mirrored base branch,
    the merge action should fail with clear rebase guidance instead of mutating
    either base branch.
- Approval note: coding and review lanes stay idle until a human approves this
  proposal.
