## Context

This change captures proposal "Seed `.data/repos` example repository and expose repository listing over HTTP" as OpenSpec change `repos-http-a1-p1-seed-data-repos-example-repository-and-expose-repositor`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Assuming the approved starter baseline is present in the claimed worktree, implement a server-only repository module rooted at `.data/repos`, idempotently ensure `example-repo` exists as a real Git repository, expose discovered repositories through `GET /api/repositories` and the main HTTP page, add ignore rules and Vitest coverage, and validate with `pnpm fmt`, `pnpm lint`, `pnpm test`, and `pnpm build`.
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
- Keep the canonical request/PR title as `feat(repositories/http): Seed `.data/repos` example repository and expose`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(repositories/http)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(repositories/http): Seed `.data/repos` example repository and expose`
- Conventional title metadata: `feat(repositories/http)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: `Seed example repo and serve repository listing` Suggested OpenSpec change: `repositories-http-a1-p1-seed-example-repo-and-serve-repository-list` Canonical request/PR title: `feat(repositories/http): Seed example repo and expose repository listing` Conventional title metadata: `feat(repositories/http)` Why a single proposal: The request is one cohesive filesystem-to-HTTP slice. Example repo seeding, repository discovery, and HTTP exposure all depend on the same `.data/repos` contract, so splitting them would create avoidable sequencing and review overhead. Implementation objective: Extend the `ugit` app baseline so `.data/repos` is the canonical repository root, an example repository is guaranteed to exist there, and all discovered repositories are exposed over HTTP. Use one shared server-only module for path resolution, seeding, and listing so the page and API route stay thin. Surface the repositories in two ways by default: `GET /api/repositories` for JSON and the main HTTP page for a browser-visible list. Expected implementation shape: - Add a server-only repository module, for example `lib/repositories.ts`, that resolves `.data/repos` from `process.cwd()`, creates the root when missing, ensures `.data/repos/example-repo` exists, and returns a stable list of discovered repositories. - Make example repo creation idempotent. Write small starter content such as `README.md`, and initialize Git metadata only when `.git` is absent. Do not try to commit a nested `.git` directory into the parent repository. - Discover repositories by scanning `.data/repos` and its direct child directories, keeping only directories with a `.git` entry. Return stable DTOs such as `name`, `path`, and `relativePath`. - Add `app/api/repositories/route.ts` that reuses the shared module and returns JSON with an HTTP 200 response. - Update the app HTTP surface, likely `app/page.tsx`, to call the same server-side listing helper and render the repository list so the feature is visible in a browser without extra tooling. - Add focused Vitest coverage for seeding idempotency, ignoring non-repositories, stable listing order and shape, and the route response contract. - Update `.gitignore` and any repo data placeholders so generated nested repository metadata under `.data/repos` does not pollute source control. Expected file touch set: - `app/page.tsx` - `app/api/repositories/route.ts` - `lib/repositories.ts` - `lib/repositories.test.ts` - `.gitignore` - `.data/repos` placeholder docs or keep files only if needed Validation contract: - `pnpm fmt` - `pnpm lint` - `pnpm test` - `pnpm build` Scope boundaries: - No repo creation UI beyond the single built-in example repo. - No repo mutation endpoints beyond the internal seed helper. - No recursive scanning outside `.data/repos`. - No auth, pagination, or extra repository metadata unless required to make the listing usable. Assumptions and risks: - `ugit` `main` currently contains only OpenSpec scaffolding. This proposal assumes the claimed coding worktree already has the approved Next.js starter baseline; if not, the coder should stop and ask whether bootstrap work must land first instead of silently broadening scope. - The example repo should be generated or ensured at runtime or setup time. Tracking a nested `.git` directory in the parent repository is not a viable source-control strategy. - The host is assumed to have `git` available for `git init`. If that is not guaranteed, the owner should decide whether a weaker directory-only example is acceptable. Approval note: This should materialize as one OpenSpec change. Coder and reviewer lanes should remain idle until human approval arrives.
