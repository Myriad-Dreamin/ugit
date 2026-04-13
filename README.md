# ugit

`ugit` is a Git-first service for mirroring repositories onto a machine you control and orchestrating pull-request publication, CI, and fast-forward merge automation over SSH plus HTTP-over-SSH.

## Current scope

This repository now ships the first end-to-end CLI and server slice:

```bash
ugit pr list [-m <machine>] [--state <open|merged|all>] [--base <branch>] [--head <branch>] [directory]
ugit pr create [-m <machine>] --base <branch> --title <title> [--body <text>] [--draft] [directory]
ugit pr edit [-m <machine>] [--base <branch>] [--title <title>] [--body <text>] [--draft|--ready] [directory]
ugit create -m <machine> [directory]
ugit serve [-m <machine>] [-p <local-port>] [directory]
ugit pr sync [-m <machine>] --base <branch> --title <title> [--body <text>] [--draft] [directory]
```

`ugit create` bootstraps a repository on a configured ugit machine and records the selected machine in local Git config for future ugit commands.

`ugit serve` opens an SSH local-port forward to the machine's Next.js server. For local machines, it short-circuits and prints the direct URL.

`ugit pr list` queries the ugit server for repository-scoped pull requests and prints a table with the latest CI state.

`ugit pr create` is the user-facing create flow. It rejects duplicate current-branch pull requests, pushes the branch to the ugit `origin`, synchronizes metadata, queues CI, and prints the queued job state.

`ugit pr edit` updates the current branch's stored pull-request metadata without pushing. Changing the base branch also queues a new CI run.

`ugit pr sync` is the lower-level republish and rerun command for branches that already have a pull request and need CI rerun after additional commits.

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
- `serverPort`: Next.js server port used by `ugit serve` and pull-request synchronization.

Machines named `local` or `localhost`, or machines whose `ssh-machine` is `local` or `localhost`, are treated as local filesystem targets. Their local Git `origin` is set to the repository path directly instead of an `ssh://` URL.

## What `ugit create` does

For `ugit create -m <machine> [directory]`, the CLI:

- verifies the target directory is a local Git repository root
- requires a local `upstream` remote
- derives the ugit repository name from the directory name
- creates the remote working-tree repository at `<machine.path>/.data/repos/<repo-name>`
- configures the remote repository's `upstream` remote
- configures the local repository's `origin` remote
- records the chosen machine in local Git config under `ugit.machine`

## Machine inference

Commands that operate on an existing ugit-backed repository can infer the target machine from local Git config:

- `ugit serve`
- `ugit pr list`
- `ugit pr create`
- `ugit pr edit`
- `ugit pr sync`

Pass `-m, --machine` to override the inferred machine.

## What `ugit serve` does

For `ugit serve [-m <machine>] [-p <local-port>] [directory]`, the CLI:

- resolves the configured ugit machine from `-m` or the repository's `ugit.machine`
- prints the direct local URL for local machines
- otherwise runs `ssh -N -T -L <local-port>:127.0.0.1:<serverPort> <ssh-machine>`

## Pull-request command boundaries

- Use `ugit pr create` the first time you publish a branch as a pull request.
- Use `ugit pr edit` when only metadata changes, or when the base branch changes and you want CI rerun against the new target branch.
- Use `ugit pr sync` after new commits land on a branch that already has a pull request.

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

## Server-side PR runner contract

The server exposes repository-scoped pull-request APIs over HTTP-over-SSH:

- `GET /api/pull-requests` lists stored pull requests for one repository and returns the latest CI job summary for each record
- `PATCH /api/pull-requests` edits stored pull-request metadata and queues CI only when the base branch changes
- `POST /api/pull-requests/sync` republishes a branch snapshot, updates pull-request metadata, and queues CI

Pull-request and CI job state are persisted in SQLite.

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

- CI runs from an isolated detached git worktree at the queued commit
- final result artifacts are written to `.data/ci-results/<repo>/<branch>.json`
- green pull requests attempt a fast-forward-only merge into the requested base branch
- merge failures are persisted as CI failures without creating merge commits
