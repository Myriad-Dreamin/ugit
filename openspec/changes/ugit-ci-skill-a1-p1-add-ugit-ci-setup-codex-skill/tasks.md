## 1. Proposal Alignment

- [ ] 1.1 Review the approved OpenSpec artifacts for "Add ugit CI setup Codex
      skill" and confirm the canonical request/PR title stays
      `feat(ci/skill): introduce ugit ci setup skill`
- [ ] 1.2 Confirm the proposal remains one repo-local `ugit-ci-setup` skill
      that scaffolds `.ugit/workflows/<workflow>/` packages, reuses
      `ugit pr sync` to queue remote CI, and does not change the current
      server-side workflow contract

## 2. Skill Implementation

- [ ] 2.1 Create `.codex/skills/ugit-ci-setup/` with `SKILL.md` plus only the
      targeted references or tiny reusable assets needed for repository
      inspection, ugit prerequisite checks, and workflow package scaffolding
- [ ] 2.2 Ensure the skill prompts for real validation commands, scaffolds a
      valid `package.json` with a `ugit:ci` entrypoint, explains the resulting
      repository changes, and offers CI queueing through `ugit pr sync` with
      clear side-effect warnings

## 3. Discoverability And Validation

- [ ] 3.1 Update `README.md` or equivalent contributor-facing documentation so
      repository users can discover and invoke the `ugit-ci-setup` skill
- [ ] 3.2 Run `pnpm fmt` and `pnpm fmt:check`, and if helper code or tests are
      added, also run the relevant `pnpm lint` and targeted test commands while
      capturing any manual validation steps for markdown-only changes
