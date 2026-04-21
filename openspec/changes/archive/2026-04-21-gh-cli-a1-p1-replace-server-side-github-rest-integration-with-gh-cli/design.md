## Context

The manual PR merge approval flow already exists, but its server-side GitHub
integration is still wired around raw Node `fetch` calls to
`https://api.github.com` plus `UGIT_GITHUB_TOKEN`:

- `lib/pull-requests/github.ts` currently resolves GitHub remotes, builds
  compare links, reads canonical PR metadata through REST, and performs squash
  merges through the GitHub REST merge endpoint.
- `lib/pr-runner/manual-merge.ts` and `lib/pr-runner/service.ts` depend on
  that module for merge readiness, canonical PR lookup, and approved merge
  execution.
- `README.md`, service messages, and UI or test expectations currently steer
  operators toward `UGIT_GITHUB_TOKEN`, even though the request wants ugit to
  reuse existing `gh auth login` state instead of adding separate token
  management.
- Browser PR detail pages already read and write through repo-scoped REST
  endpoints, and that boundary must remain in place. The change is server-only.

This proposal stays cohesive because the adapter swap, readiness messaging,
README guidance, and focused regression coverage all depend on the same
server-side GitHub integration boundary. Splitting those concerns would leave
mixed auth models and partially updated operator guidance.

## Goals / Non-Goals

**Goals:**
- Replace token-gated server-side GitHub REST fetches with a server-only `gh`
  CLI adapter for canonical PR lookup and merge execution.
- Preserve current manual-merge behavior: canonical PR lookup remains available
  to readiness checks, approved merges stay squash-only, head-SHA guarded, and
  fail closed on not-found, auth, or mergeability problems.
- Keep existing GitHub remote discovery and compare-link delegation behavior so
  repository PR pages still surface GitHub destinations without depending on a
  checked-out working tree.
- Keep all browser-facing PR reads and writes behind repo-scoped REST
  endpoints and avoid any browser-side GitHub transport.
- Add focused regression coverage and docs that move operator guidance from
  `UGIT_GITHUB_TOKEN` to `gh auth login` and `gh auth status`.

**Non-Goals:**
- Add broader GitHub synchronization such as reviews, labels, comments,
  status-check mirrors, or PR creation beyond the current manual merge flow.
- Introduce new token storage or config management on top of `gh` auth state.
- Change the current merge strategy away from squash-only approved merges with
  mirrored-base realignment after GitHub accepts the merge.
- Expand browser responsibilities or let workflow or PR pages call GitHub
  directly.

## Decisions

- Replace the current fetch-and-token helper with a server-only `gh` command
  bridge that exposes the same high-level operations: resolve repository
  coordinates, read canonical PR metadata, and execute an approved merge.
  Rationale: the ugit host can reuse existing `gh auth login` state without
  duplicating token management in Node, and the manual-merge service can keep
  the same server-only responsibility boundary.
  Alternative considered: keep raw REST calls and improve token setup.
  Rejected because it preserves the operator burden and the exact failure mode
  that motivated this change.

- Keep remote discovery and compare-link shaping in `lib/pull-requests/github.ts`,
  but add an injectable `gh` command runner abstraction for canonical lookup
  and merge execution.
  Rationale: the module already owns GitHub remote parsing and compare-link
  fallback behavior, so the least disruptive refactor is to swap only the
  authenticated transport while making command execution easy to stub in tests.
  Alternative considered: move GitHub command execution into
  `lib/pr-runner/manual-merge.ts`. Rejected because it would duplicate
  repository-context logic and spread GitHub concerns across unrelated modules.

- Pass explicit repository targeting on every `gh` invocation using discovered
  owner and repository coordinates.
  Rationale: ugit evaluates merge readiness from mirrored repositories and
  server routes, not from a user shell inside the original checkout. Explicit
  `-R owner/repo` targeting keeps `gh` independent from the current working
  directory and preserves existing repo-scoped behavior.
  Alternative considered: rely on the current directory or `GH_REPO`.
  Rejected because it makes server behavior sensitive to process cwd and
  ambient shell state.

- Use `gh` JSON commands for PR lookup and `gh api` for the final merge call.
  Rationale: `gh pr list --json` plus `gh pr view --json` match the current
  lookup needs, while `gh api` can preserve the existing immediate
  squash-merge contract and expected-head-SHA guard without relying on
  higher-level `gh pr merge` behavior that may prefer auto-merge or merge
  queues on protected branches.
  Alternative considered: use `gh pr merge --squash --match-head-commit` for
  approved merges. Rejected for the first cut because the change explicitly
  needs fail-closed immediate squash semantics rather than queue- or
  auto-merge-oriented behavior.

- Normalize `gh` failures into typed unavailable or not-ready outcomes with
  operator guidance that points to `gh auth login` or `gh auth status`.
  Rationale: missing binary, failed auth, malformed JSON, missing PR metadata,
  merge conflicts, and command-start failures all need distinct handling so the
  repo-scoped UI can keep merge readiness blocked without exposing raw process
  failures to the browser.
  Alternative considered: bubble raw stderr strings directly through the
  service. Rejected because it makes user-facing behavior inconsistent and hard
  to test.

## Conventional Title

- Canonical request/PR title:
  `refactor(github/merge): switch GitHub merge adapter to gh`
- Conventional title metadata: `refactor(github/merge)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [The ugit host may not have `gh` installed or authenticated] -> Treat missing
  binary, failed auth, or unsupported host state as blocked readiness with
  explicit install or `gh auth login` remediation.
- [`gh` stdout and stderr become part of the contract] -> Keep command parsing
  narrow, validate JSON before mapping it into pull-request shapes, and add
  regression coverage for malformed output and command-start failures.
- [Approved merges can still fail on head drift or protected-branch rules] ->
  preserve head-SHA guarding through the CLI-mediated merge path and surface
  GitHub rejection as a fail-closed not-ready outcome.
- [The transport refactor touches both helper and service layers] -> keep the
  external pull-request detail and merge response shapes stable so the browser
  contract does not need a broader redesign.
- [Existing GitHub remote parsing only targets current supported GitHub-style
  remotes] -> preserve that behavior in this change and avoid expanding host
  support while the transport swap is underway.

## Migration Plan

- Refactor `lib/pull-requests/github.ts` into a server-only `gh` command bridge
  that preserves repository-context resolution and delegation-link behavior.
- Replace canonical PR lookup and approved merge execution in
  `lib/pr-runner/manual-merge.ts` and `lib/pr-runner/service.ts` so the happy
  path no longer depends on `UGIT_GITHUB_TOKEN` or raw GitHub `fetch` calls.
- Update README guidance, service messages, and UI or test expectations to
  point operators toward `gh auth login` and `gh auth status`.
- Add focused regression coverage around command runner stubs, auth failure,
  missing PR metadata, malformed JSON, merge conflict, and command-start
  failure cases.
- Validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and
  `pnpm build`.
- Rollback remains straightforward before release: restore the existing REST
  helper and token messaging, then remove the `gh` bridge without changing the
  browser REST contract.

## Open Questions

- None. This proposal intentionally keeps the scope to the authenticated
  transport swap. If later work needs GitHub Enterprise host expansion, review
  synchronization, or browser-side GitHub features, those should land as
  follow-up changes.
