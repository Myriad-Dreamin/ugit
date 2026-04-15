---
name: ugit-ci-setup
description: Inspect a repository, scaffold `.ugit/workflows/<workflow>/`, verify ugit prerequisites, and optionally trigger remote validation through the existing ugit CLI.
---

Use this skill when the user wants Codex to set up ugit CI for a repository.

This skill scaffolds `.ugit/workflows/<workflow>/` packages. It does not
replace `ugit create`, `ugit serve`, `ugit workflow run`, `ugit workflow logs`,
or `ugit pr create`.

Read these references before editing workflow files:

- `references/workflow-contract.md`
- `references/remote-validation.md`

Reuse these template assets when you scaffold a workflow package:

- `templates/package.json.template.json`
- `templates/run-ugit-ci.sh.template`

## Default workflow

1. Resolve the target repository.
   - Default to the current working directory unless the user names another
     repository path.
   - Confirm the Git root with `git rev-parse --show-toplevel`.
   - Inspect any existing `.ugit/workflows/*` packages before proposing a new
     workflow name.

2. Inspect the repository before asking questions.
   Collect signals in parallel:
   - existing `.ugit/workflows/**/*`
   - package-manager files such as `package.json`, `pnpm-workspace.yaml`,
     `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, and `bun.lockb`
   - existing CI definitions such as `.github/workflows/*`, `.gitlab-ci.yml`,
     and `.circleci/**/*`
   - common stack files such as `Cargo.toml`, `go.mod`, `pyproject.toml`, and
     `Makefile`
   - repository connectivity details from `git remote -v` and
     `git config --local --get ugit.machine`

   Prefer these sources when you infer the validation command:
   - an existing root `ci` script
   - an obvious root script chain such as `lint`, `test`, then `build`
   - a command already used by existing CI files
   - stack-native commands such as `cargo test`, `go test ./...`, `pytest`, or
     `make test`

   Ask only for missing high-signal inputs:
   - the workflow name when the repository does not already imply one
   - the validation command when repository signals are ambiguous
   - PR metadata only when the user explicitly wants `ugit pr create`

   Do not invent a placeholder `ugit:ci` command. If inference is weak, stop
   and ask the user for the exact validation command to wrap.

3. Scaffold or update `.ugit/workflows/<workflow>`.
   - Reuse an existing workflow package when the requested workflow already
     exists.
   - Otherwise create:
     - `.ugit/workflows/<workflow>/package.json`
     - `.ugit/workflows/<workflow>/run-ugit-ci.sh`
   - Fill the template placeholders with the confirmed workflow name and the
     repository command that should run from the repository root.
   - Keep the workflow package minimal and set `run-ugit-ci.sh` executable.

4. Verify the local workflow package shape.
   - Confirm `package.json` exists and defines `scripts.ugit:ci`.
   - Confirm `run-ugit-ci.sh` returns to the repository root before running the
     wrapped command.
   - Run `pnpm --dir .ugit/workflows/<workflow> run ugit:ci` when the command
     is safe to execute locally.
   - If the underlying command is destructive or expensive, ask before running
     it.

5. Verify ugit prerequisites before remote validation.
   Stop before remote execution if any of these checks fail:
   - `ugit` is available. When you are inside this repository and the binary is
     missing, build it with `pnpm --filter ugit-cli build`.
   - `~/.local/share/ugit/config.json` exists and includes the requested or
     configured machine.
   - the target repository resolves a ugit machine via
     `git config --local --get ugit.machine` or an explicit `-m`
   - `git remote get-url origin` points at the ugit repository that `ugit`
     commands will publish to, or the repository has already been created with
     `ugit create`
   - the workflow package still matches the contract in
     `references/workflow-contract.md`

   Remediation should point back to existing ugit commands instead of
   reimplementing them:
   - no machine binding: `ugit create -m <machine> [directory]`
   - no config or server access: fix `~/.local/share/ugit/config.json`, SSH, or
     `ugit serve -m <machine>`
   - PR-backed CI requested: use `ugit pr create`, not a custom branch-publish
     flow

6. Offer remote validation only after prerequisites pass.
   - Default smoke path:
     - `ugit workflow run [-m <machine>] <workflow> [directory]`
     - capture the printed workflow ID
     - `ugit workflow logs [-m <machine>] <workflowId> [directory]`
   - Use `ugit pr create --base <branch> --title <title> ...` only when the
     user explicitly asks for PR-backed CI or auto-merge semantics.

7. Close out with a practical summary.
   Include:
   - the inferred or confirmed validation command
   - the workflow name and files created or updated
   - the local smoke result
   - whether remote validation ran or which prerequisite blocked it
