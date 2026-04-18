## 1. Scope Alignment

- [ ] 1.1 Confirm the approved change keeps the canonical request/PR title `fix(workflow/runs): Show repo workflow runs` and conventional-title metadata `fix(workflow/runs)` without altering the assigned change path
- [ ] 1.2 Reproduce the current queue-to-list visibility regression and trace the repository identity flow across validation, storage, API, and page bootstrap or refresh

## 2. Repo Workflow Run Visibility

- [ ] 2.1 Add a regression that queues a workflow run for a repository and asserts it appears in the repo-scoped runs API and `/${user}/${repo}/workflows` bootstrap and refresh behavior
- [ ] 2.2 Align queue validation, workflow-run storage, and shared repo-scoped read helpers around the same repository identity while preserving strict cross-repository rejection
- [ ] 2.3 Update the repo-scoped runs API and repository workflow list page bootstrap or refresh path to use the aligned read behavior without importing backend workflow services directly for browser reads

## 3. Verification

- [ ] 3.1 Add focused Vitest coverage for touched storage, service, API, and page boundaries, including queued, running, and completed run visibility plus cross-repository rejection
- [ ] 3.2 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, targeted `pnpm test` coverage for the workflow read path, and `pnpm build`
