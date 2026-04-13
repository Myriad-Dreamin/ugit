## Context

This change captures proposal "Add configured single-user repository pages" as OpenSpec change `repo-pages-a1-p1-add-configured-single-user-repository-pages`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Materialize one OpenSpec change that introduces a checked-in owner config for the sole username `Myriad-Dreamin`, adds a dynamic `/${user}/${repo}` App Router page backed by shared filesystem helpers for repository-root entries in `.data/repos/<repo>`, updates the current repository list UI to link into that route, covers invalid-user, missing-repo, stable-ordering, and `.git`-filtering behavior with tests, and validates with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- Preserve a reviewable OpenSpec contract before coding starts.
- Keep the proposal logical enough that any pooled worker can execute it.
- Reuse a managed worktree from `/home/kamiyoru/work/ts/ugit/.meow-team-worktrees/meow-N` for cache-friendly execution.

**Non-Goals:**
- Bind this proposal to a specific branch or worker slot before approval.
- Expand scope beyond the approved proposal without human feedback.
- Merge sibling proposals into a single coding pass without replanning.

## Decisions

- Store the proposal as a dedicated OpenSpec change before coding begins.
- Let the pooled coding-review runtime allocate execution branches and worktrees after approval.
- Use planner output as the starting point for reviewer validation and follow-up tasks.
- Prefer incremental implementation that can be requeued after machine review feedback.
- Keep the canonical request/PR title as `feat(user/repos): Add configured single-user repository pages`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(user/repos)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(user/repos): Add configured single-user repository pages`
- Conventional title metadata: `feat(user/repos)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: Add single-user repository pages Suggested OpenSpec change: `repo-pages-a1-p1-add-single-user-config-and-repo-file-list-pages` Why a single proposal: The request is one route-and-data slice. Username configuration, route validation, repository-root file listing, and page rendering all depend on the same `.data/repos` contract, so splitting them would add approval and execution overhead without improving safety. Implementation objective: Extend the existing repository HTTP surface so the app has one checked-in owner configuration (`Myriad-Dreamin`) and serves `/${user}/${repo}` pages that list the direct children of `.data/repos/<repo>`. Expected implementation shape: - Add a small checked-in config module for the sole supported username `Myriad-Dreamin`, plus a helper to validate and build repository URLs. Keep this config simple and checked into the repo; do not introduce environment-driven multi-user behavior unless approval changes scope. - Reuse the current `.data/repos` helper area instead of creating duplicate filesystem logic. Extend `lib/repositories.ts` or an adjacent server-only helper with repository lookup by name and root-entry listing for a specific repo. - The repo page should read the repository root at runtime, sort entries stably, include both files and directories, and exclude the internal `.git` directory from the rendered list. - Add `app/[user]/[repo]/page.tsx` as a dynamic server route. Exact-match the configured username, and call `notFound()` for an unknown user, a missing repo, or a path that is not one of the known repositories under `.data/repos`. - Update the existing home page repository cards to link to the new canonical route `/${configuredUser}/${repository.name}` so the feature is discoverable. - Keep page logic thin. Prefer pure helper functions in `lib/` for branching logic so Vitest can cover the behavior in the existing node-based test setup. - Add focused tests for username validation, repository lookup, repo-root entry listing, `.git` filtering, stable ordering, and missing-repo handling. Add route-level tests only where they add value beyond helper coverage. Validation contract: - `pnpm fmt` - `pnpm fmt:check` - `pnpm lint` - `pnpm test` - `pnpm build` Scope boundaries: - No auth or multi-user support beyond the single configured username. - No nested directory navigation, recursive browsing UI, or file-content viewer. - No new mutation endpoints or repository write operations. - No separate file-list API unless approval explicitly expands the surface. Assumptions and risks: - “List files” is interpreted as listing direct entries at the repository root for `/Myriad-Dreamin/<repo>`, not a recursive dump of the entire repository tree. - Username matching is assumed to be exact and case-sensitive because the request names one canonical username. - The route should only expose repositories already recognized under `.data/repos`; arbitrary directories should not become routable by accident. Approval note: Materialize this as one OpenSpec change. Coder and reviewer lanes should stay idle until a human approves it.
