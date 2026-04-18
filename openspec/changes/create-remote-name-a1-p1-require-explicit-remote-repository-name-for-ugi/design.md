## Context

`ugit create` currently exposes `-m, --machine`, `--override-origin`, and an
optional `[directory]`. The create library then resolves the repository root
and derives `repositoryName` from `path.basename(repositoryPath)`, which is
used for the remote repository path, origin URL, success output, and
origin-conflict messaging.

That derived-name behavior is now the part of the contract that needs to
change. Downstream pull-request and workflow flows already resolve canonical
repository identity from the configured `origin` URL instead of the local
directory name, so the request can stay focused on `ugit create`.

The main constraint is the existing optional `[directory]` positional. Adding a
second positional for the remote repository name would make the CLI ambiguous,
so the explicit remote name needs to be a required option. Because that value
now feeds directly into remote paths and URLs, validation must reject path
traversal and nested repository names without unnecessarily rejecting otherwise
valid names such as names with spaces.

## Goals / Non-Goals

**Goals:**
- Require `ugit create` to receive an explicit remote repository name via a
  required `--name <remote-repo-name>` option.
- Remove the implicit basename fallback from the create-library contract and
  use the provided name for remote repository path or URL computation,
  origin-conflict inspection, success output, and local recovery guidance.
- Validate the provided name as one safe path segment while preserving existing
  quoting behavior for otherwise valid names, including names with spaces.
- Refresh CLI help, `README.md`, the new OpenSpec wording, and focused Vitest
  coverage so the breaking contract is obvious and testable.
- Preserve the canonical request/PR title `fix(cli/create): require remote
  repository name` and conventional-title metadata `fix(cli/create)` throughout
  the materialized artifacts.

**Non-Goals:**
- Add a rename or migration flow for repositories that were previously created
  from the local directory basename.
- Change PR or workflow APIs, server-side repository lookup rules, or
  repository pages.
- Support multi-segment remote repository paths or any fallback back to the
  local checkout name.
- Replace the recommended `--name` option with a second positional argument.

## Decisions

- Require `--name <remote-repo-name>` in the Clipanion command instead of
  adding another positional argument.
  Rationale: `ugit create` already uses `[directory]` to target a local
  checkout. A required option keeps the local checkout path and remote
  repository identity separate and avoids ambiguous parsing.
  Alternative considered: accept `<remote-repo-name>` as a positional and move
  or reinterpret `[directory]`. Rejected because it would overload the current
  call shape and make the breaking change harder to understand.

- Thread the explicit name through both the CLI command and the create-library
  contract, rather than only changing the top-level command parser.
  Rationale: `inspectCreateRepositoryOriginConflict()` and `createRepository()`
  both compute URLs and messages today. They need the same explicit input so
  prompts, errors, and success output all reference the same repository name.
  Alternative considered: keep deriving the name in library code and only use
  `--name` for display. Rejected because it would leave the remote path or URL
  generation tied to the local basename.

- Validate the remote name as one safe path segment before any remote setup or
  local origin mutation happens.
  Rationale: this input now feeds directly into filesystem paths, SSH URLs, and
  shell-command rendering. Rejecting empty values, `.` or `..`, and path
  separators blocks traversal and nested-path misuse without forbidding valid
  single-segment names that need shell quoting.
  Alternative considered: restrict names to slug-like ASCII tokens. Rejected
  because the existing create flow already quotes shell-unsafe values, and the
  approved request explicitly keeps otherwise valid names such as names with
  spaces.

- Keep origin-conflict behavior unchanged except that it now targets the
  user-supplied remote repository name.
  Rationale: the approved scope is a naming-contract change, not a redesign of
  the prompt or override flow. The existing interactive prompt,
  non-interactive rejection, and `--override-origin` approval path should keep
  working once they compute the ugit URL from the explicit name.
  Alternative considered: revisit prompt timing or add a new conflict flag as
  part of this change. Rejected because that expands scope without solving the
  requested problem.

- Treat docs and tests as part of the breaking CLI contract.
  Rationale: existing users already have `ugit create -m <machine> [directory]`
  in scripts and habits. Help text, README guidance, and focused Vitest
  coverage are part of making the contract explicit and reviewable.
  Alternative considered: update only runtime behavior and defer docs or tests.
  Rejected because that would make a breaking change harder to discover and
  easier to regress.

## Conventional Title

- Canonical request/PR title: `fix(cli/create): require remote repository name`
- Conventional title metadata: `fix(cli/create)`
- Slash-delimited roadmap/topic scope stays in conventional-title metadata and
  does not alter `branchPrefix` or OpenSpec change paths.

## Risks / Trade-offs

- [Breaking existing automation] -> Make `--name` required in help output,
  README examples, and error messages so existing scripts fail with actionable
  guidance instead of silently changing behavior.
- [Over-restricting repository names] -> Limit validation to the approved safe
  single-segment rules and keep shell quoting for otherwise valid names such as
  names with spaces.
- [Path traversal or nested remote paths] -> Reject `.`, `..`, and path
  separators before building remote repository paths, URLs, or recovery
  commands.
- [Origin-conflict message drift] -> Route the explicit remote name through both
  origin-conflict inspection and repository creation so prompts, failures, and
  success output stay consistent.

## Migration Plan

- Land this as an intentional breaking CLI change with updated docs and tests.
- Existing repositories that already point `origin` at ugit remain supported
  because downstream flows resolve repository identity from the configured
  `origin` URL.
- There is no automatic migration or rename step for repositories that were
  created from the old basename-derived behavior.
- Rollback, if needed, is a straight revert to the basename fallback and the
  previous help or README wording.

## Open Questions

- None.
