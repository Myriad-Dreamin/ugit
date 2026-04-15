## 1. Proposal Alignment

- [x] 1.1 Review the approved OpenSpec artifacts for "Add ugit CI setup Codex skill" and confirm the canonical request/PR title is `feat(codex/ci): Add ugit CI setup skill`
- [x] 1.2 Confirm the change remains repo-local, conventional-title metadata `feat(codex/ci)` stays separate from the OpenSpec change path, and PR-backed CI is optional rather than the default smoke path

## 2. Skill Authoring

- [x] 2.1 Add `.codex/skills/ugit-ci-setup/SKILL.md` with trigger guidance, progressive-disclosure decision points, and a default workflow for inspection, scaffolding, prerequisite checks, and optional remote validation
- [x] 2.2 Add only the minimal supporting references, templates, or helper assets needed to scaffold `.ugit/workflows/<workflow>/` packages around the documented `ugit:ci` contract

## 3. Scaffolding and Verification Flow

- [x] 3.1 Implement the skill flow that inspects repository tooling, infers likely validation commands, and asks only for missing high-signal inputs before creating or updating workflow files
- [x] 3.2 Implement prerequisite checks for ugit CLI availability, machine configuration, repository connectivity, and workflow package shape, with remediation that points back to existing ugit commands instead of reimplementing them
- [x] 3.3 Add the optional remote validation flow that defaults to `ugit workflow run <workflow>` plus `ugit workflow logs <workflowId>` and uses `ugit pr create` only when the user explicitly requests PR-backed CI

## 4. Documentation and Validation

- [x] 4.1 Add light repository documentation so humans can discover the `ugit-ci-setup` skill and understand that it builds on the existing ugit CLI
- [x] 4.2 Run `pnpm fmt`, `pnpm fmt:check`, and, if the implementation adds JS or TS helpers, `pnpm lint`, plus complete at least one concrete smoke exercise that scaffolds a workflow and queues a remote run when a safe target exists

## Validation notes

- Dedicated harness lanes can mount `.codex` and `.git` read-only, so
  `./scripts/track-ugit-ci-skill.sh` now writes a lane-local discovery mirror
  tree at `.data/codex-skills/ugit-ci-setup/` without touching the
  mounted worktree or Git metadata paths.
- `lib/codex-skills.test.ts` now verifies the discovery payload from the
  worktree when present and otherwise falls back to the committed `HEAD`
  tree, so the default proof still requires the real repo-local
  `.codex/skills/ugit-ci-setup` payload even when a read-only mount hides it.
- Use the `CODEX_SKILLS_DISCOVERY_PREFIX=<absolute-mirror-root>` command that
  `./scripts/track-ugit-ci-skill.sh` prints only for explicit mirror parity
  checks; the lane-local `.data/codex-skills/ugit-ci-setup/` mirror is not a
  substitute for the committed `.codex` discovery tree.
- `./scripts/materialize-ugit-ci-skill.sh` still copies the authored payload
  into any writable destination, so other checkouts can refresh
  `.codex/skills/ugit-ci-setup` without reimplementing the file list.
- `./scripts/sync-ugit-ci-skill.sh` reuses that materialization helper,
  refreshes `.codex/skills/ugit-ci-setup` before staging, supports
  `--repo-root /path/to/writable-checkout`, and now points back to
  `./scripts/track-ugit-ci-skill.sh` when the destination checkout mounts
  `.codex` read-only and needs the lane-local proof path instead.
- `./scripts/export-ugit-ci-skill-patch.sh` now emits an applicable
  `.codex/skills/ugit-ci-setup` patch from the authored payload so a writable
  checkout can land the required discovery tree even when this lane can only
  produce proof artifacts.
- `./scripts/smoke-ugit-ci-skill.sh` still provides the concrete smoke path by
  materializing the skill into a temporary writable `.codex` tree, reusing
  `lib/codex-skills.test.ts`, scaffolding a temporary
  `.ugit/workflows/ci` package from the committed templates, and running
  `pnpm --dir <temp>/.ugit/workflows/ci run ugit:ci`.
- Remote workflow-run smoke validation still depends on a safe ugit machine
  config; this lane currently has no `~/.local/share/ugit/config.json`, so the
  smoke exercise verifies local scaffolding plus the prerequisite gate.
