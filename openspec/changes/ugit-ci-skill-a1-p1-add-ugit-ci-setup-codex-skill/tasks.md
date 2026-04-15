## 1. Proposal Alignment

- [x] 1.1 Review the approved OpenSpec artifacts for "Add ugit CI setup Codex skill" and confirm the canonical request/PR title is `feat(codex/ci): Add ugit CI setup skill`
- [x] 1.2 Confirm the change remains repo-local, conventional-title metadata `feat(codex/ci)` stays separate from the OpenSpec change path, and PR-backed CI is optional rather than the default smoke path

## 2. Skill Authoring

- [ ] 2.1 Add `.codex/skills/ugit-ci-setup/SKILL.md` with trigger guidance, progressive-disclosure decision points, and a default workflow for inspection, scaffolding, prerequisite checks, and optional remote validation
- [ ] 2.2 Add only the minimal supporting references, templates, or helper assets needed to scaffold `.ugit/workflows/<workflow>/` packages around the documented `ugit:ci` contract

## 3. Scaffolding and Verification Flow

- [ ] 3.1 Implement the skill flow that inspects repository tooling, infers likely validation commands, and asks only for missing high-signal inputs before creating or updating workflow files
- [ ] 3.2 Implement prerequisite checks for ugit CLI availability, machine configuration, repository connectivity, and workflow package shape, with remediation that points back to existing ugit commands instead of reimplementing them
- [ ] 3.3 Add the optional remote validation flow that defaults to `ugit workflow run <workflow>` plus `ugit workflow logs <workflowId>` and uses `ugit pr create` only when the user explicitly requests PR-backed CI

## 4. Documentation and Validation

- [x] 4.1 Add light repository documentation so humans can discover the `ugit-ci-setup` skill and understand that it builds on the existing ugit CLI
- [x] 4.2 Run `pnpm fmt`, `pnpm fmt:check`, and, if the implementation adds JS or TS helpers, `pnpm lint`, plus complete at least one concrete smoke exercise that scaffolds a workflow and queues a remote run when a safe target exists

## Blockers

- The lane worktree mounts `.codex` as a separate read-only filesystem, so the
  required `.codex/skills/ugit-ci-setup` path still cannot be materialized from
  this checkout. Direct writes fail with `Read-only file system`, for example
  `mkdir -p .codex/skills/ugit-ci-setup`. Git metadata for this worktree is
  also read-only, so the lane cannot stage or commit a workaround into
  `.git/worktrees/meow-1` either.
- The authored skill payload remains ready under `skills/ugit-ci-setup/`. Copy
  steps for a writable checkout now live in
  `skills/ugit-ci-setup/MATERIALIZE.md`.
- Remote workflow-run smoke validation also depends on a safe ugit machine
  config; this lane currently has no `~/.local/share/ugit/config.json`, so the
  smoke exercise can only verify local scaffolding plus the prerequisite gate.
