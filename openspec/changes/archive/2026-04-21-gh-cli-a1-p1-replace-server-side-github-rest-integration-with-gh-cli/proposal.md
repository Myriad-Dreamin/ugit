## Why

Manual GitHub-backed merge approval currently depends on raw server-side
`fetch` calls to `api.github.com` plus `UGIT_GITHUB_TOKEN`, so the merge flow
blocks on extra token management even when the ugit host is already
authenticated with `gh auth login`. That mismatch is showing up in operator
errors now, and the safest fix is one transport swap that keeps the existing
manual-merge behavior, repo-scoped browser boundary, and PR lookup semantics
while moving authenticated GitHub work behind the `gh` CLI.

## What Changes

- Introduce the
  `gh-cli-a1-p1-replace-server-side-github-rest-integration-with-gh-cli`
  OpenSpec change for proposal "Replace server-side GitHub REST integration
  with gh CLI".
- Refactor the server-only GitHub adapter in `lib/pull-requests/github.ts`
  from token-based Node `fetch` calls into a `gh` CLI command bridge that keeps
  the existing remote-discovery and GitHub compare-link behavior.
- Replace canonical PR lookup and squash-merge execution with explicit-repo
  `gh` commands that preserve the current return shape, head-SHA guard,
  squash-only merge semantics, and fail-closed behavior for auth, not-found,
  or mergeability problems.
- Remove `UGIT_GITHUB_TOKEN` from the happy path for manual merge readiness and
  execution by wiring `lib/pr-runner/manual-merge.ts`,
  `lib/pr-runner/service.ts`, and focused tests around injectable command
  runner stubs instead of raw GitHub fetch or token plumbing.
- Update README guidance, service messages, and UI or test expectations from
  `UGIT_GITHUB_TOKEN` setup to `gh auth login` and `gh auth status` guidance,
  while keeping browser-facing PR pages on repo-scoped REST endpoints only.

## Capabilities

### New Capabilities
- `gh-cli-a1-p1-replace-server-side-github-rest-integration-with-gh-cli`:
  Replace token-gated server-side GitHub REST fetches with `gh` CLI-backed PR
  lookup and merge execution while preserving current manual-merge semantics
  and repo-scoped browser boundaries.

### Modified Capabilities
- None.

## Conventional Title

- Canonical request/PR title:
  `refactor(github/merge): switch GitHub merge adapter to gh`
- Conventional title metadata: `refactor(github/merge)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Impact

- Affected repository: `ugit`
- Planner summary: Swap server-side GitHub PR lookup and merge operations from
  token-gated REST fetches to a `gh` CLI adapter while keeping manual-merge
  behavior and repo-scoped browser boundaries intact.
- Affected code areas: `lib/pull-requests/github.ts`,
  `lib/pull-requests/github.test.ts`, `lib/pr-runner/manual-merge.ts`,
  `lib/pr-runner/service.ts`, `README.md`,
  `app/[user]/[repo]/pull-requests/[pullRequestId]/pull-request-detail-client.test.tsx`,
  and focused regression coverage around GitHub command execution, readiness,
  merge outcomes, and operator guidance
- Validation contract: `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`,
  and `pnpm build`
- Scope boundaries: no browser-side GitHub calls; no broader GitHub review,
  sync, or status-check features beyond current PR lookup plus squash merge; no
  new token or config management layered on top of `gh` auth state
- Key assumptions and risks:
  - The ugit server must have `gh` installed and authenticated for the target
    GitHub host; missing binary or failed auth must block readiness with
    actionable remediation.
  - `gh` command exit codes, stdout, and stderr become part of the adapter
    contract, so malformed JSON and command-start failures need explicit test
    coverage.
  - If high-level `gh pr merge` behavior cannot guarantee immediate
    fail-closed squash semantics on protected branches, the implementation must
    route the merge through `gh api` while still removing raw Node fetch and
    token management.
- Approval note: coding and review lanes stay idle until a human approves this
  proposal.
