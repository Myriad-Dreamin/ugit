## Context

This change captures proposal "Add machine-aware PR transport and synchronization flow" as OpenSpec change `pr-runner-a1-p1-add-machine-aware-pr-transport-and-synchronization-flow`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Materialize OpenSpec change `pr-runner-a1-p1-add-machine-aware-pr-transport-and-sync` to extend the existing Clipanion CLI with machine inference, `ugit serve`, and PR publish/synchronize commands, add shared SSH and HTTP transport helpers, and add server-side PR intake and persistence so repositories can register pull requests against a configured ugit machine without replanning `ugit create`.
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
- Keep the canonical request/PR title as `feat(pr/runner): implement ugit PR runner`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(pr/runner)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(pr/runner): implement ugit PR runner`
- Conventional title metadata: `feat(pr/runner)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Recommended plan: split this request into 2 proposals. Why this should not be one oversized proposal: - The repository already has the initial `packages/ugit-cli` Clipanion app, `ugit create`, repository HTTP routes, and server-only SQLite support. - The missing work separates cleanly into a PR control-plane slice and a CI/merge execution slice. - Proposal 2 depends on the contracts from proposal 1, but proposal 1 is still independently reviewable and reduces implementation risk. Proposal 1 - Suggested OpenSpec change: `pr-runner-a1-p1-add-machine-aware-pr-transport-and-sync` - Canonical title: `feat(ugit/pr): Add machine-aware PR transport and synchronization flow` - Objective: extend the existing CLI so a repository connected to a configured ugit machine can infer its machine from local git config, open or reuse an SSH port-forward with `ugit serve`, publish branch metadata, and synchronize pull-request metadata to the remote ugit server over HTTP through that tunnel. - Expected implementation shape: - Reuse the current config and machine-resolution layer in `packages/ugit-cli` instead of rebuilding repository creation. - Add shared SSH helpers for local-vs-remote machines, port-forwarding, and remote HTTP base URL resolution. - Add Clipanion commands for `ugit serve` plus PR publish/synchronize flows; the internal API should expose the provided `GitPlatformPublishedBranch` and `SynchronizeGitPlatformPullRequestArgs` shapes. - Read `ugit.machine` from local git config when `-m/--machine` is omitted inside a configured repository. - Add server-side HTTP intake for synchronized PR payloads and persist PR state in a server-side store, preferably SQLite, so later runner automation has a stable source of truth. - Add focused tests for config resolution, machine inference, tunnel command construction, publish/sync payloads, and HTTP error handling. - Scope boundaries: - Do not implement actual workflow execution or merging in this proposal. - Keep `ugit create` behavior as the baseline; only make narrow shared-helper adjustments needed for the new commands. Proposal 2 - Suggested OpenSpec change: `pr-runner-a1-p2-add-remote-ci-runner-and-auto-merge` - Canonical title: `feat(ugit/ci): Add remote CI runner and auto-merge` - Objective: build the remote PR runner that consumes synchronized PR records, queues CI jobs at the remote commit, enforces one active CI job per repository and four active jobs globally, records results under `.data/ci-results/<repo-name>/<branch-name>.json`, and merges successful PRs into the base branch. - Expected implementation shape: - Add a server-side queue/worker layer that survives concurrent requests and serializes work per repository. - For each queued PR run, check out the target repository on the ugit server, run each `.ugit/workflows/<workflow>/` package, collect status/output/timestamps, and persist the run result. - Update PR state based on runner outcome and merge the head branch into the base branch only after successful validation. - Add tests for queue scheduling, per-repo exclusivity, global concurrency cap, result-file persistence, failed workflow handling, and merge-success/merge-conflict paths. - Scope boundaries: - No extra UI is required unless implementation needs minimal diagnostics exposure. - No alternative merge strategies unless approval expands scope. Assumptions and risks to carry into spec materialization: - The request does not define the exact workflow-package command. Recommend formalizing one convention in the change, for example `pnpm --dir .ugit/workflows/<workflow> run ci`. - The request does not define merge semantics. Recommend a non-interactive merge commit flow by default; if squash or fast-forward-only behavior is required, that should be clarified before coding. - A durable in-process runner assumes the deployed ugit HTTP server is a long-lived self-hosted Node process, not a serverless runtime. - Result JSON path is specified, but schema is not. The change should define a minimal stable result shape including repo, branch, commit, workflow outcomes, timestamps, and merge outcome. Recommended approval sequence: - Approve proposal 1 first to lock the CLI/API/data contract. - Approve proposal 2 after that contract is accepted, or approve both together if the owner wants one batch. Coding and review lanes should stay idle until a human approves one or both proposals.
