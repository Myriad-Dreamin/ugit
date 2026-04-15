## 1. Proposal Alignment

- [x] 1.1 Review the approved OpenSpec artifacts for "Add ugit CI setup Codex skill" and confirm the canonical request/PR title is `feat(codex/ci): Add ugit CI setup skill`
- [x] 1.2 Confirm the change remains repo-local, conventional-title metadata `feat(codex/ci)` stays separate from the OpenSpec change path, and PR-backed CI is optional rather than the default smoke path

## 2. Skill Authoring

- [ ] 2.1 Add `.codex/skills/ugit-ci-setup/SKILL.md` with trigger guidance, progressive-disclosure decision points, and a default workflow for inspection, scaffolding, prerequisite checks, and optional remote validation
- [x] 2.2 Add only the minimal supporting references, templates, or helper assets needed to scaffold `.ugit/workflows/<workflow>/` packages around the documented `ugit:ci` contract

## 3. Scaffolding and Verification Flow

- [x] 3.1 Implement the skill flow that inspects repository tooling, infers likely validation commands, and asks only for missing high-signal inputs before creating or updating workflow files
- [x] 3.2 Implement prerequisite checks for ugit CLI availability, machine configuration, repository connectivity, and workflow package shape, with remediation that points back to existing ugit commands instead of reimplementing them
- [x] 3.3 Add the optional remote validation flow that defaults to `ugit workflow run <workflow>` plus `ugit workflow logs <workflowId>` and uses `ugit pr create` only when the user explicitly requests PR-backed CI

## 4. Documentation and Validation

- [x] 4.1 Add light repository documentation so humans can discover the `ugit-ci-setup` skill and understand that it builds on the existing ugit CLI
- [x] 4.2 Run `pnpm fmt`, `pnpm fmt:check`, and, if the implementation adds JS or TS helpers, `pnpm lint`, plus complete at least one concrete smoke exercise that scaffolds a workflow and queues a remote run when a safe target exists

## Validation notes

- Dedicated harness lanes can mount `.codex` read-only, so this implementation
  cannot materialize `.codex/skills/ugit-ci-setup` directly in this checkout.
- This lane also cannot create `.git/worktrees/meow-1/index.lock`, so the
  repo-local `.codex` discovery payload still needs to be synced from a
  writable checkout before task 2.1 can be marked complete.
- `./scripts/materialize-ugit-ci-skill.sh` now copies the authored payload into
  any writable destination, so other checkouts can refresh
  `.codex/skills/ugit-ci-setup` without reimplementing the file list.
- `./scripts/sync-ugit-ci-skill.sh` now reuses that materialization helper,
  refreshes `.codex/skills/ugit-ci-setup` before staging, and supports
  `--skip-git-add` when only the in-place discovery copy needs to be updated.
- `./scripts/smoke-ugit-ci-skill.sh` now provides a committed read-only-lane
  smoke path by materializing the skill into a temporary writable `.codex`
  tree, reusing `lib/codex-skills.test.ts`, and scaffolding a temporary
  `.ugit/workflows/ci` package from the committed templates.
- Remote workflow-run smoke validation still depends on a safe ugit machine
  config; this lane currently has no `~/.local/share/ugit/config.json`, so the
  smoke exercise verifies local scaffolding plus the prerequisite gate.
