## 1. Scope Alignment

- [ ] 1.1 Confirm the approved change keeps the canonical request/PR title `fix(repo/workflows): show manual workflow runs` and conventional-title metadata `fix(repo/workflows)` without altering the assigned change path
- [ ] 1.2 Review the current workflow storage and service read helpers so the implementation stays centered on repo-scoped workflow read identity rather than queue, runner, or UI changes

## 2. Stable Repository Identity Reads

- [ ] 2.1 Add a focused regression that models a stored manual workflow run whose `repository_name` matches the requested repository while the stored `repository_path` differs from the currently resolved path string
- [ ] 2.2 Update workflow storage helpers to list and fetch repo-scoped workflow runs by stored `repository_name` for repository list, detail, and named log reads while leaving workflow-id-only reads unchanged
- [ ] 2.3 Route the existing workflow service, repo-scoped API, and browser read paths through the new helpers and preserve explicit not-found behavior for true cross-repository mismatches

## 3. Verification

- [ ] 3.1 Add targeted Vitest coverage for workflow storage, service, API, and page regressions around path-alias or repository-root drift mismatches plus true cross-repository rejection
- [ ] 3.2 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, and `pnpm build`
