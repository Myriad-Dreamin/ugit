# Remote validation path

Use remote validation only after the workflow package exists and local
prerequisites are satisfied.

Prerequisite checks:

- `ugit` is installed and runnable
- `~/.local/share/ugit/config.json` exists and contains the selected machine
- the repository resolves a machine through `ugit.machine` or an explicit `-m`
- the repository already has the ugit `origin` that `ugit create` configures
- `.ugit/workflows/<workflow>/package.json` defines `scripts.ugit:ci`

Default smoke flow:

1. Run `pnpm --dir .ugit/workflows/<workflow> run ugit:ci` when safe to do so.
2. Run `ugit workflow run [-m <machine>] <workflow> [directory]`.
3. Parse the printed workflow ID from the command output.
4. Run `ugit workflow logs [-m <machine>] <workflowId> [directory]`.

PR-backed CI is opt-in:

- use `ugit pr create --base <branch> --title <title> [--body <text>] [--draft] [directory]`
- reserve this path for users who explicitly want pull-request CI and
  auto-merge semantics

When prerequisites fail, stop before queueing a remote run and point the user
back to the existing ugit commands or repository setup they still need.
