# ugit

`ugit` is a Git-first service for mirroring repositories onto a machine you control and, in later changes, orchestrating pull-request publication, CI, and merge automation.

## Install the private CLI

`ugit-cli` is private to this monorepo. From the repository root, build it and link it globally with `pnpm`:

```bash
pnpm install
pnpm build:cli
pnpm --dir packages/ugit-cli link --global
```

The global `ugit` binary now points at this checkout. Re-run `pnpm build:cli` after CLI code changes before using the linked command.

## Current CLI surface

This repository currently ships these CLI commands:

```bash
ugit create -m <machine> [directory]
ugit serve -m <machine> [-p <local-port>]
```

`ugit create` bootstraps a repository on a configured ugit machine and records the selected machine in local Git config for future ugit commands. `ugit serve` opens an SSH local port forward so the selected ugit server is reachable at `http://127.0.0.1:<local-port>`.

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

- `ssh-machine`: SSH host name used for remote repository setup and `ugit serve`.
- `path`: Absolute path to the ugit server root on that machine.
- `serverPort`: Port where the ugit HTTP server listens. `ugit serve` uses it as the remote port and also as the default local port.

Machines named `local` or `localhost`, or machines whose `ssh-machine` is `local` or `localhost`, are treated as local filesystem targets. Their local Git `origin` is set to the repository path directly instead of an `ssh://` URL.

## `ugit create`

### Prerequisites

- Git must be installed and available on `PATH`.
- The target directory must already be the root of a local Git repository.
- The local repository must already have an `upstream` remote configured.
- The selected machine must be present in `~/.local/share/ugit/config.json`.
- For non-local machines, SSH access to the configured host must already work.

### What it does

For `ugit create -m <machine> [directory]`, the CLI:

- verifies the target directory is a local Git repository root
- requires a local `upstream` remote
- derives the ugit repository name from the directory name
- creates the remote working-tree repository at `<machine.path>/.data/repos/<repo-name>`
- configures the remote repository's `upstream` remote
- configures the local repository's `origin` remote
- records the chosen machine in local Git config under `ugit.machine`

## `ugit serve`

### Prerequisites

- The selected machine must be present in `~/.local/share/ugit/config.json`.
- The selected machine's ugit HTTP server must already be listening on `serverPort`.
- SSH access to the configured `ssh-machine` must already work, including entries that point at `localhost`.
- The chosen local port must be free on the current machine.

### What it does

For `ugit serve -m <machine> [-p <local-port>]`, the CLI:

- resolves the selected machine from the shared ugit config
- defaults `local-port` to the configured `serverPort` when `-p` is omitted
- starts `ssh -N -o ExitOnForwardFailure=yes -L <local-port>:127.0.0.1:<serverPort> <ssh-machine>`
- prints the forwarded local URL as `http://127.0.0.1:<local-port>`
- keeps the SSH tunnel attached to the current terminal until interrupted

## Planned follow-up scope

The following remain intentionally out of scope for this change:

- pull-request publish and synchronize commands
- CI queueing and `.data/ci-results` management
- merge automation
