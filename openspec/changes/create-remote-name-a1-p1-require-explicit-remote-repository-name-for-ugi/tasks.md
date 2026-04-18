## 1. Scope Alignment

- [ ] 1.1 Confirm the approved change keeps the canonical request/PR title `fix(cli/create): require remote repository name` and conventional-title metadata `fix(cli/create)` without altering the assigned change path
- [ ] 1.2 Finalize the explicit `ugit create --name <remote-repo-name>` contract so the optional `[directory]` positional and `--override-origin` flow remain unambiguous

## 2. Create Command Contract

- [ ] 2.1 Update `packages/ugit-cli/src/commands/create.ts` to require `--name`, pass it into origin-conflict inspection and repository creation, and refresh help examples plus success or error wording for the breaking contract
- [ ] 2.2 Update `packages/ugit-cli/src/create.ts` so the create-library contract accepts the explicit remote name, validates it as one safe path segment, and uses it for remote repository path or URL generation plus origin-conflict and recovery messaging

## 3. Documentation and Tests

- [ ] 3.1 Update `README.md` and create-command documentation to show the required remote repository name, clarify allowed and rejected values, and distinguish the remote repository name from the optional local `[directory]`
- [ ] 3.2 Add focused Vitest coverage in `packages/ugit-cli/src/commands/create.test.ts` and `packages/ugit-cli/src/create.test.ts` for required-name parsing, invalid names, explicit-name path or URL computation, and origin-conflict handling with the provided name

## 4. Verification

- [ ] 4.1 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`
