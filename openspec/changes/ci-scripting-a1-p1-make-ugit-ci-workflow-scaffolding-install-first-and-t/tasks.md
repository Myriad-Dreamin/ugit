## 1. Proposal Alignment

- [ ] 1.1 Preserve the canonical request/PR title `ci(ugit/ci-setup): adopt install-first TypeScript CI scaffolding` and conventional-title metadata `ci(ugit/ci-setup)` throughout this change
- [ ] 1.2 Keep the current workflow runner contract generic and install-first instead of adding new server-side workflow shape requirements

## 2. Skill And Template Authoring

- [ ] 2.1 Update `skills/ugit-ci-setup/SKILL.md`, `skills/ugit-ci-setup/references/workflow-contract.md`, and the authored templates so the recommended scaffold uses a TypeScript entrypoint instead of `run-ugit-ci.sh`
- [ ] 2.2 Refresh `.codex/skills/ugit-ci-setup` through the existing materialization or sync flow so the discovery payload matches the authored skill byte-for-byte

## 3. Proofs And Contract Coverage

- [ ] 3.1 Update `scripts/materialize-ugit-ci-skill.sh`, `scripts/export-ugit-ci-skill-patch.sh`, `scripts/smoke-ugit-ci-skill.sh`, and `lib/codex-skills.test.ts` for the new scaffold files and the install-then-run smoke path
- [ ] 3.2 Add or adjust focused coverage only where needed around `packages/ugit-cli/src/workflow-package.ts` and `lib/pr-runner/workflows.ts` so install-before-run behavior remains explicit and protected

## 4. Docs And Validation

- [ ] 4.1 Update `README.md` and related materialization guidance so local verification explicitly installs workflow dependencies before invoking `ugit:ci` and recommends TypeScript-based workflow logic for maintainability and cross-platform behavior
- [ ] 4.2 Validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, `pnpm build` when runtime code changes, and `./scripts/smoke-ugit-ci-skill.sh`
