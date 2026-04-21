## 1. Proposal Alignment

- [ ] 1.1 Confirm the canonical request/PR title is `ci(workflow/ci): standardize install-first TypeScript CI workflows`, keep conventional-title metadata `ci(workflow/ci)` explicit, and preserve the approved OpenSpec change path `workflow-ts-ci-a1-p1-workflow-ci-a1-p1-install-before-run-and-favor-type`
- [ ] 1.2 Reuse the existing install-before-run contract in `packages/ugit-cli/src/workflow.ts` and `packages/ugit-cli/src/workflow.test.ts` instead of redesigning local workflow execution semantics

## 2. Skill Templates And Guidance

- [ ] 2.1 Update `skills/ugit-ci-setup` and `.codex/skills/ugit-ci-setup` so the skill guidance, workflow-contract reference, and remote-validation reference all document install-before-run local validation
- [ ] 2.2 Replace the shell-wrapper template with a TypeScript workflow entrypoint template and update the scaffolded workflow `package.json` to invoke the approved Node TypeScript runtime command

## 3. Helper Parity And Smoke Flow

- [ ] 3.1 Update `scripts/materialize-ugit-ci-skill.sh`, `scripts/export-ugit-ci-skill-patch.sh`, and `lib/codex-skills.test.ts` so authored and discovery skill payloads track the new TypeScript template filenames consistently
- [ ] 3.2 Update `scripts/smoke-ugit-ci-skill.sh` and any related materialization docs so the smoke workflow scaffolds the TypeScript entrypoint and runs `pnpm install --dir <workflow> --ignore-workspace --no-frozen-lockfile` before `pnpm --dir <workflow> run ugit:ci`

## 4. Repository Docs And Validation

- [ ] 4.1 Update `README.md` and `skills/ugit-ci-setup/MATERIALIZE.md` so every local workflow validation example and template description matches the TypeScript-first scaffold and install-first contract
- [ ] 4.2 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, focused `pnpm test`, and `pnpm build` as feasible, keeping local workflow-order coverage and skill payload parity coverage green
