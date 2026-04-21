# ugit

`ugit` is a Git-first service for mirroring repositories onto a machine you control and orchestrating pull-request publication, CI, and manual GitHub-backed merge approval over SSH plus HTTP-over-SSH.

## Current scope

This repository now ships the first end-to-end CLI and server slice:

```bash
ugit pr list [-m <machine>] [--state <open|merged|all>] [--base <branch>] [--head <branch>] [directory]
ugit pr create [-m <machine>] --base <branch> --title <title> [--body <text>] [--draft] [directory]
ugit pr edit [-m <machine>] [--base <branch>] [--title <title>] [--body <text>] [--draft|--ready] [directory]
ugit workflow run [--local] [-m <machine>] [-p <local-port>] <workflow> [directory]
ugit workflow logs [-m <machine>] [-p <local-port>] <workflowId> [directory]
ugit create -m <machine> --name <remote-repo-name> [--override-origin] [directory]
ugit serve [-m <machine>] [-p <local-port>] [directory]
ugit pr sync [-m <machine>] --base <branch> --title <title> [--body <text>] [--draft] [directory]
```

`ugit create` bootstraps a repository on a configured ugit machine with an explicit remote repository name and records the selected machine in local Git config for future ugit commands.

`ugit serve` opens an SSH local-port forward to the machine's Next.js server. For local machines, it short-circuits and prints the direct URL.

`ugit pr list` queries the ugit server for repository-scoped pull requests and prints a table with the latest CI state.

`ugit pr create` is the user-facing create flow. It rejects duplicate current-branch pull requests, pushes the branch to the ugit `origin`, synchronizes metadata, queues CI, and prints the queued job state.

`ugit pr edit` updates the current branch's stored pull-request metadata without pushing. Changing the base branch also queues a new CI run.

`ugit pr sync` is the lower-level republish and rerun command for branches that already have a pull request and need CI rerun after additional commits.

`ugit workflow run` defaults to pushing the current branch to the ugit `origin`, queueing one named remote workflow against that commit, and printing the workflow ID plus queue position. Pass `--local` to run the named workflow package directly against the current repository working tree in the foreground for debugging.

`ugit workflow logs` streams a remote manual workflow run's append-only server logs over HTTP-over-SSH until the run finishes. Local `--local` runs do not create a `workflowId` and cannot be tailed with `ugit workflow logs`.

## Codex skills

The authored `ugit-ci-setup` skill payload lives in `skills/ugit-ci-setup`.
Its repo-local discovery path is `.codex/skills/ugit-ci-setup`.

Use it when you want Codex to inspect a repository, scaffold
`.ugit/workflows/<workflow>/`, verify local ugit prerequisites, and optionally
trigger `ugit workflow run` plus `ugit workflow logs`. The skill builds on the
existing ugit CLI instead of replacing `ugit create`, `ugit serve`,
`ugit pr create`, or the workflow commands.

Run `./scripts/materialize-ugit-ci-skill.sh <destination>` when you need to
copy the authored payload into a writable Codex discovery root such as another
checkout or a temporary smoke directory.

Run `./scripts/track-ugit-ci-skill.sh` when the current checkout mounts
`.codex` and `.git` read-only. That helper writes a lane-local discovery mirror
tree at `.data/codex-skills/ugit-ci-setup/`. Use the printed
`CODEX_SKILLS_DISCOVERY_PREFIX=... pnpm exec vitest run lib/codex-skills.test.ts`
command only for an explicit mirror parity check. It does not satisfy the
repo-local `.codex/skills/ugit-ci-setup` requirement.

Run `./scripts/export-ugit-ci-skill-patch.sh --output .data/codex-skills/ugit-ci-setup.patch`
when this lane cannot write `.codex` or `.git` but you need an exact patch to
apply from a writable checkout. The patch adds the required
`.codex/skills/ugit-ci-setup` files and can be applied with `git apply`.

Run `./scripts/sync-ugit-ci-skill.sh` from a writable checkout to refresh
`.codex/skills/ugit-ci-setup`, stage those repo-local skill files, and then
rerun `pnpm exec vitest run lib/codex-skills.test.ts`. Pass
`--repo-root /path/to/writable-checkout` when you need to sync another checkout
from this lane, or `--skip-git-add` when you only need the in-place `.codex`
copy refreshed. If that writable materialization fails because the destination
mounts `.codex` read-only, the script now points back to
`./scripts/track-ugit-ci-skill.sh` for the lane-local proof path and to
`./scripts/export-ugit-ci-skill-patch.sh` for a writable-checkout handoff,
while keeping the default repository proof tied to the committed `.codex`
tree.

Run `./scripts/smoke-ugit-ci-skill.sh` when you need a read-only-lane smoke
exercise. It materializes the skill into a temporary writable `.codex` path,
reuses `lib/codex-skills.test.ts` against that temp discovery tree, scaffolds a
temporary `.ugit/workflows/ci` package from the committed templates, and runs
`pnpm --dir <temp>/.ugit/workflows/ci run ugit:ci`.

## Prerequisites for `ugit create`

- Git must be installed and available on `PATH`.
- The target directory must already be the root of a local Git repository.
- The local repository must already have an `upstream` remote configured.
- The selected machine must be present in `~/.local/share/ugit/config.json`.
- For non-local machines, SSH access to the configured host must already work.

## Config file

`ugit` reads machine definitions from `~/.local/share/ugit/config.json`.

```json
{
  "machines": {
    "local": {
      "ssh-machine": "localhost",
      "path": "/path/to/ugit/server",
      "serverPort": 3001
    },
    "machine-x": {
      "ssh-machine": "kamiya-machine-x",
      "path": "/path/to/ugit/server",
      "serverPort": 3001
    }
  }
}
```

Field notes:

- `ssh-machine`: SSH host name used for remote setup.
- `path`: Absolute path to the ugit server root on that machine.
- `serverPort`: Next.js server port used by `ugit serve`, pull-request synchronization, and workflow commands.

Machines named `local` or `localhost`, or machines whose `ssh-machine` is `local` or `localhost`, are treated as local filesystem targets. Their local Git `origin` is set to the repository path directly instead of an `ssh://` URL.

## What `ugit create` does

For `ugit create -m <machine> --name <remote-repo-name> [--override-origin] [directory]`, the CLI:

- verifies the target directory is a local Git repository root
- requires a local `upstream` remote
- requires `--name` to provide the remote repository identity explicitly
- rejects remote names that are empty, `.` or `..`, or contain `/` or `\`
- creates the remote working-tree repository at `<machine.path>/.data/repos/<remote-repo-name>`
- configures the remote repository's `upstream` remote
- prompts before replacing a conflicting local `origin` remote during interactive runs
- configures or updates the local repository's `origin` remote
- records the chosen machine in local Git config under `ugit.machine`

`--name` controls the remote ugit repository name. The optional `[directory]`
still selects which local repository root the command operates on.
Otherwise valid single-segment names, including names with spaces, remain
supported when quoted in your shell.

When a repository already has a different local `origin`, interactive terminals
prompt before replacing it with the computed ugit URL. Non-interactive runs do
not prompt; pass `--override-origin` to approve the replacement explicitly in
scripts or CI.

## Machine inference

Commands that operate on an existing ugit-backed repository can infer the target machine from local Git config:

- `ugit serve`
- `ugit pr list`
- `ugit pr create`
- `ugit pr edit`
- `ugit pr sync`
- `ugit workflow run`
- `ugit workflow logs` when you run it inside a ugit-backed repository

Pass `-m, --machine` to override the inferred machine.

`ugit workflow run --local` is the exception: it resolves only the repository root, does not read `ugit.machine`, and rejects `-m, --machine` plus `-p, --port`.

## GitHub merge approvals

- Install `gh` on the ugit server and authenticate it for the target GitHub host with `gh auth login` before using manual pull-request merges from the repository detail page.
- Use `gh auth status` on the ugit server to confirm the active account and authentication state before troubleshooting merge readiness.
- The authenticated `gh` session must allow pull-request reads plus squash-merge writes for the target GitHub repository.
- After the latest CI job succeeds, ugit keeps the pull request in status `passed` until a user approves the merge from the repository pull-request detail page.
- The merge action rechecks the latest successful CI result, verifies the mirrored local base branch still matches the fetched GitHub base branch, confirms GitHub reports the canonical pull request as mergeable, then performs a GitHub squash merge and realigns the mirrored local base branch to the fetched GitHub base commit.
- If the branch is no longer fast-forwardable from the mirrored base branch, ugit blocks the merge and tells the user to rebase or update the branch, rerun CI, and retry.

## Validation

Run these checks before finishing a change in this repository:

- `pnpm fmt`
- `pnpm fmt:check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## What `ugit serve` does

For `ugit serve [-m <machine>] [-p <local-port>] [directory]`, the CLI:

- resolves the configured ugit machine from `-m` or the repository's `ugit.machine`
- prints the direct local URL for local machines
- otherwise runs `ssh -N -T -L <local-port>:127.0.0.1:<serverPort> <ssh-machine>`

## Pull-request command boundaries

- Use `ugit pr create` the first time you publish a branch as a pull request.
- Use `ugit pr edit` when only metadata changes, or when the base branch changes and you want CI rerun against the new target branch.
- Use `ugit pr sync` after new commits land on a branch that already has a pull request.
- Use the repository pull-request detail page to approve manual merges after the pull request reaches status `passed`.

## Workflow command boundaries

- Use `ugit workflow run <workflow>` to queue one named remote workflow without creating or mutating a pull request.
- Use `ugit workflow run --local <workflow>` to debug one workflow package in place against your current working tree. Local runs may reuse or mutate dependency state under `.ugit/workflows/<workflow>/`.
- Use `ugit workflow logs` only for remote queued runs that returned a `workflowId`.
- Remote manual workflow runs share the same queue capacity as pull-request CI jobs, but they never auto-merge.

## What `ugit pr list` does

For `ugit pr list [--state <open|merged|all>] [--base <branch>] [--head <branch>] [directory]`, the CLI:

- resolves the repository root and target machine
- queries the ugit server over HTTP-over-SSH instead of reading remote state from disk
- filters pull requests for the current repository by state, base branch, and head branch
- prints numeric PR IDs, branch targets, titles, and the latest CI job status

## What `ugit pr create` does

For `ugit pr create --base <branch> --title <title> [--body <text>] [--draft] [directory]`, the CLI:

- resolves the repository root, target machine, and current branch
- rejects duplicate pull requests for the same repository branch before any push happens
- pushes the current branch to the ugit `origin`
- publishes the branch using the shared `GitPlatformPublishedBranch` contract
- synchronizes PR metadata using the shared `SynchronizeGitPlatformPullRequestArgs` contract
- queues CI on the remote ugit server and prints the queued job ID plus queue position

## What `ugit pr edit` does

For `ugit pr edit [--base <branch>] [--title <title>] [--body <text>] [--draft|--ready] [directory]`, the CLI:

- resolves the repository root, target machine, and current branch
- updates stored pull-request metadata over HTTP-over-SSH without pushing new commits
- reuses the existing synchronization queue when the base branch changes so CI reruns against the new base
- leaves existing CI queue history intact for metadata-only edits

## What `ugit pr sync` does

For `ugit pr sync --base <branch> --title <title> [--body <text>] [directory]`, the CLI:

- resolves the repository root and target machine
- pushes the current branch to the ugit `origin`
- publishes the branch using the shared `GitPlatformPublishedBranch` contract
- synchronizes PR metadata using the shared `SynchronizeGitPlatformPullRequestArgs` contract
- queues CI on the remote ugit server and prints the queued job ID plus queue position
- repurposes the existing pull request instead of creating a second record for the same branch

## What `ugit workflow run` does

For `ugit workflow run <workflow> [directory]` without `--local`, the CLI:

- resolves the repository root and target machine
- pushes the current branch HEAD to the ugit `origin` before queueing the run
- publishes the branch using the shared `GitPlatformPublishedBranch` contract
- queues one named workflow run over HTTP-over-SSH and prints the workflow ID plus queue position
- reuses the same one-per-repository and four-global runner limits as pull-request CI

For `ugit workflow run --local <workflow> [directory]`, the CLI:

- resolves only the repository root and rejects `-m, --machine` plus `-p, --port`
- validates the requested `.ugit/workflows/<workflow>/package.json` plus `ugit:ci` script locally before starting
- runs `pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
- then runs `pnpm --dir <workflow> run ugit:ci` directly against the current repository working tree with stdout and stderr attached to your terminal
- exits with the local child-process result instead of queueing a remote run, creating a `workflowId`, or producing `ugit workflow logs`
- may reuse or mutate workflow dependency caches under `.ugit/workflows/<workflow>/`

## What `ugit workflow logs` does

For `ugit workflow logs [-p <local-port>] <workflowId> [directory]`, the CLI:

- resolves the target machine from `-m` or the repository's `ugit.machine` when available
- streams live workflow-run logs over HTTP-over-SSH instead of tailing remote files directly
- follows appended log output until the workflow run reaches a terminal status
- applies only to remote queued workflow runs that have a `workflowId`

## Server-side runner contract

The server exposes repository-scoped pull-request and workflow-run APIs over HTTP-over-SSH:

- `GET /api/pull-requests` lists stored pull requests for one repository and returns the latest CI job summary for each record
- `GET /api/pull-requests/[pullRequestId]?repositoryName=<repo>` returns repo-scoped detail, merge readiness, and GitHub delegation for one pull request
- `PATCH /api/pull-requests` edits stored pull-request metadata and queues CI only when the base branch changes
- `POST /api/pull-requests/[pullRequestId]/merge?repositoryName=<repo>` revalidates readiness, performs the GitHub squash merge, and realigns the mirrored local base branch
- `POST /api/pull-requests/sync` republishes a branch snapshot, updates pull-request metadata, and queues CI
- `POST /api/workflows/runs` queues one named workflow run against a published branch snapshot
- `GET /api/workflows/logs?workflowId=<id>` streams append-only workflow logs until the run completes

Pull-request, CI job, and workflow-run state are persisted in SQLite.

Queueing rules:

- at most one active CI job runs per repository
- at most four active CI jobs run across the whole ugit server
- queued and running jobs survive process restarts through durable job records

Workflow contract:

- every workflow must live under `.ugit/workflows/<workflow>/`
- every workflow directory must contain a `package.json`
- every workflow package must define a `ugit:ci` script
- the runner executes `pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile`
- the runner then executes `pnpm --dir <workflow> run ugit:ci`
- missing packages, missing scripts, install failures, or script failures fail CI with actionable output

Execution model:

- CI runs from an isolated detached git worktree at the queued commit and removes that temporary checkout after the job finishes
- manual workflow runs reuse the managed repo-local worktree `.data/repos/<repo>/workflow1`, reset tracked state to the queued commit before each run, preserve reusable untracked workflow caches during normal preparation, and never attempt a merge
- final result artifacts are written to `.data/ci-results/<repo>/<branch>.json`
- manual workflow logs are appended to `.data/workflow-run-logs/<repo>/<workflowId>.log`
- successful pull requests stay open in status `passed` until a user approves a merge from the repo-scoped detail page
- manual merge approval requires current passing CI, mirrored-base parity with GitHub, and GitHub mergeability before ugit requests a squash merge
- after GitHub creates the squash commit, ugit fetches the base branch again and fast-forwards the mirrored local base branch to that fetched GitHub commit
- if that post-merge base update starts tracking `workflow1`, ugit removes the managed linked worktree first so the mirrored repository stays clean and the path can become ordinary repository content
