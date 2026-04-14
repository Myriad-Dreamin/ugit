## Context

This change plans a repo-local skill, not a new CLI or server protocol. The
repository already documents the runner contract for
`.ugit/workflows/<workflow>/`, machine configuration in
`~/.local/share/ugit/config.json`, and pull-request-based CI queueing through
`ugit pr sync`; the missing piece is a reusable Codex workflow that turns those
facts into guided repository setup with minimal duplication. Although the repo
now also includes manual workflow commands, the assigned scope is to keep the
skill's default remote-CI trigger aligned with the existing PR synchronization
path rather than inventing a CI-only contract.

## Goals / Non-Goals

**Goals:**

- Add one repo-local `.codex/skills/ugit-ci-setup/` skill that can be invoked
  from this repository.
- Make the skill deterministic: inspect the repository, confirm ugit
  prerequisites or guide the user through `ugit create`, gather the real
  validation commands, scaffold `.ugit/workflows/<workflow>/`, explain the repo
  changes, and offer to queue CI through `ugit pr sync`.
- Keep supporting references and reusable assets minimal so the skill stays
  generic across repositories instead of hardcoding one stack.
- Update discoverability docs so repository users can find and use the skill
  without reading source code first.

**Non-Goals:**

- Add a new `ugit ci trigger` command, polling API, or server-side protocol.
- Assume every target repository has `lint`, `test`, and `build` scripts.
- Build stack-specific workflow templates for every ecosystem.
- Change the current server contract for `.ugit/workflows/<workflow>/` packages
  or the current PR/auto-merge semantics behind `ugit pr sync`.

## Decisions

- Implement the feature as one repo-local skill under `.codex/skills` plus
  on-demand reference material, instead of adding a new CLI entrypoint. This
  keeps the work repository-local and lets Codex guide users interactively
  without server changes.
- Use light repository inspection plus explicit user confirmation for
  validation commands. Fully automatic command detection across arbitrary
  repositories is unreliable and would create incorrect `ugit:ci` scripts.
- Keep reusable assets minimal: prefer a tiny workflow `package.json` template
  or similarly small helper only if it materially reduces repeated edits.
  Large stack-specific templates would overfit the current repositories and
  increase maintenance.
- Default remote CI queueing to `ugit pr sync` after the skill explains the
  side effects, especially that successful CI can feed the current auto-merge
  behavior. Reusing the existing PR path is the contract this proposal is meant
  to preserve.
- Make discoverability explicit in `README.md` or an equivalent contributor doc
  so the skill is a supported repository workflow instead of hidden local
  knowledge.

## Risks / Trade-offs

- [Command detection false positives] -> Require the user to confirm or edit
  detected validation commands before writing `ugit:ci`.
- [Triggering CI may merge on success] -> Have the skill explain the existing
  `ugit pr sync` side effects and ask before running it.
- [Template drift across repositories] -> Keep reusable assets small and align
  them with the documented workflow contract instead of application-specific
  assumptions.
- [Documentation-only behavior can rot] -> Add isolated tests if helper scripts
  are introduced; otherwise keep references tightly scoped to documented ugit
  contracts and capture manual validation steps.
- [Assignment metadata mismatch] -> Preserve
  `feat(ci/skill): introduce ugit ci setup skill` as canonical request metadata
  while keeping "Add ugit CI setup Codex skill" as the proposal title.

## Migration Plan

- Add the skill, any targeted reference files, and optional tiny scaffold
  assets in one repository-local change under `.codex/skills`.
- Update discoverability docs in the same change so the new skill is visible at
  the moment it lands.
- Run `pnpm fmt` and `pnpm fmt:check` for the markdown artifacts; if
  implementation adds helper code, also run `pnpm lint` and the targeted tests
  that cover the helper behavior.
- Existing repositories adopt the skill only when a user invokes it; no server
  data migration is required.

## Open Questions

- The assignment carries two title phrasings. These artifacts preserve
  `feat(ci/skill): introduce ugit ci setup skill` as canonical metadata unless
  the owner updates the request metadata before approval.
- If the owner later wants CI-only dry runs with no PR or auto-merge side
  effects, that should become a follow-up proposal instead of broadening this
  change.
