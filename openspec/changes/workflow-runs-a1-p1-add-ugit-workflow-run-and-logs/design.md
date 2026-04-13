## Context

This change captures proposal "Add ugit workflow run and logs" as OpenSpec change `workflow-runs-a1-p1-add-ugit-workflow-run-and-logs`.
Implementation starts only after human approval and is claimed by the next
available coding-review worker from the shared pool.

## Goals / Non-Goals

**Goals:**
- Materialize OpenSpec change `workflow-runs-a1-p1-add-ugit-workflow-run-and-logs` with canonical title `feat(workflow/runs): Add ugit workflow run and logs`. Add Clipanion `ugit workflow run [workflow]` and `ugit workflow logs [workflowId]` commands, workflow-run request and log-stream contracts over HTTP-over-SSH, durable workflow-run metadata plus append-only log storage keyed by workflowId, targeted single-workflow execution on the existing CI runner, shared one-per-repo and four-global queue limits with PR jobs, README/help updates, focused Vitest coverage, and validation with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
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
- Keep the canonical request/PR title as `feat(workflow/runs): Add ugit workflow run and logs`.
- Keep slash-delimited roadmap/topic scope in conventional-title metadata `feat(workflow/runs)` instead of `branchPrefix` or OpenSpec change paths.

## Conventional Title

- Canonical request/PR title: `feat(workflow/runs): Add ugit workflow run and logs`
- Conventional title metadata: `feat(workflow/runs)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and does not alter `branchPrefix` or OpenSpec change paths.


## Risks / Trade-offs

- [Proposal drift] -> Compare implementation against the approved OpenSpec artifacts before coding.
- [Sibling proposal overlap] -> Send cross-proposal changes back to request-group replanning.
- [Reusable worktree residue] -> Reset the managed worktree before each proposal run.
- [Validation gaps] -> Require reviewer findings and task completion before treating work as complete.

Planner deliverable reference: Proposal: `Add ugit workflow run and logs` Suggested OpenSpec change: `workflow-runs-a1-p1-add-ugit-workflow-run-and-logs` Canonical request/PR title: `feat(workflow/runs): Add ugit workflow run and logs` Conventional title metadata: `feat(workflow/runs)` Planner note: the assignment referenced `.codex/skills/team-harness-workflow`, but that skill directory is not present in this checkout, so this plan follows `INSTRUCTIONS.md`, the available OpenSpec skills, and the existing archived proposal patterns in `openspec/changes/archive`. Why one proposal: - `workflow run`, `workflow logs`, durable workflow IDs, shared CI capacity limits, and live log transport all depend on the same server-side execution model. Splitting them would either leave a trigger command with no observability or create a log surface with no manual workflow-run producer. Repository context to honor: - `packages/ugit-cli` already has Clipanion-based machine-aware commands plus temporary SSH port forwarding through `withMachineServer`. - The server already persists PR CI jobs in SQLite and enforces one active job per repository and four active jobs globally through `lib/pr-runner/storage.ts` and `lib/pr-runner/runner.ts`. - Workflow execution currently runs every `.ugit/workflows/*` package and only captures buffered output after completion, so live logs require new tee/persistence behavior rather than relying only on the existing branch result artifact. Implementation objective: - Add `ugit workflow run [workflow]` to queue one named workflow against the current repository branch/commit and print the generated workflow id plus queue state. - Add `ugit workflow logs [workflowId]` to stream live logs for that workflow run over HTTP-over-SSH until the run completes or fails. - Keep all communication on SSH or HTTP-over-SSH. The CLI must not tail remote files directly. - Make manual workflow runs share the same remote CI capacity limits as PR jobs, but do not auto-merge or mutate PR state for manual runs. Expected implementation shape: - Register new Clipanion commands in `packages/ugit-cli/src/cli.ts` and add a dedicated workflow client/contract module beside the existing PR helpers. - Reuse current machine inference, repository-root resolution, and `withMachineServer` transport. First cut should push the current branch to ugit `origin` before queueing so the requested commit exists on the server. - Add server APIs for queueing a workflow run and streaming logs, likely under `app/api/workflows/...`, with validation that keeps repository access scoped to the configured ugit repositories root. - Persist manual workflow-run metadata keyed by workflowId, including repository, branch, commit, workflow name, status, timestamps, and log location. This can be implemented by generalizing current CI-job storage or adding a sibling table, but PR jobs and manual workflow runs must share the same scheduler bookkeeping. - Extend the runner/process stack so stdout/stderr are tee'd into append-only log storage while the job runs, then expose a server stream that tails existing content and waits for new bytes until the workflow leaves `queued` or `running`. - Add targeted single-workflow execution for `.ugit/workflows/[workflow]/` while preserving existing PR behavior of running every workflow and writing branch-level CI result artifacts. - Preserve current PR APIs and merge semantics; only the new manual workflow-run path should use workflowId-based log streaming. - Update README and CLI help text with command usage, machine inference, queue semantics, and the distinction between PR-triggered CI and ad hoc workflow runs. Validation contract: - `pnpm fmt` - `pnpm fmt:check` - `pnpm lint` - `pnpm test` - `pnpm build` Scope boundaries: - No workflow cancellation, retry history, workflow listing, or web UI. - No multi-workflow fan-out from one manual command; `[workflow]` targets one workflow package. - No direct remote filesystem tailing from the CLI. - No change to PR auto-merge behavior beyond sharing capacity with manual runs. Assumptions and risks: - Assumption: the first cut runs against the current local branch HEAD and republishes it to the ugit origin before queueing. If product expectation is instead “run the remote branch without pushing,” this needs replanning. - The current command runner buffers output until exit, so live streaming needs a new tee/log sink to avoid holding large logs in memory. - Shared queue enforcement is the main architectural risk; separate PR and workflow schedulers would violate the existing one-per-repo and four-global CI limits. Approval note: - Materialize this as one OpenSpec change once approved. - Coding-review lanes stay idle until human approval arrives.
