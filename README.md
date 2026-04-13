# ugit

`ugit` is a Git-first service for mirroring repositories onto a machine you control and, in later changes, orchestrating pull-request publication, CI, and merge automation.

## Current scope

This repository currently ships the first CLI slice only:

```bash
ugit create -m <machine> [directory]
```

The command bootstraps a repository on a configured ugit machine and records the selected machine in local Git config for future ugit commands.

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
- `serverPort`: Reserved for future commands such as `ugit serve`.

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

## Planned follow-up scope

The following remain intentionally out of scope for this change:

- `ugit serve`
- pull-request publish and synchronize commands
- CI queueing and `.data/ci-results` management
- merge automation
