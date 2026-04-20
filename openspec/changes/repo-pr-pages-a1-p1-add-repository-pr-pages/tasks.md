## 1. Pull-request Read Model

- [ ] 1.1 Extend the shared pull-request contract with browser-safe repo list/detail DTOs for PR summaries, CI job history, workflow execution summaries, activity entries, and GitHub delegation metadata
- [ ] 1.2 Add repo-scoped validation plus storage and service helpers to list pull requests by `repositoryName` and read one PR by `{ repositoryName, pullRequestId }` with cross-repository isolation and 404 handling
- [ ] 1.3 Add forward-only pull-request activity persistence or fallback timeline shaping for create, sync, edit, CI start, CI finish, and merge transitions
- [ ] 1.4 Parse `.data/ci-results/<repo>/<branch>.json` artifacts into PR detail workflow execution summaries without breaking reads when artifacts are missing or malformed

## 2. REST Boundary

- [ ] 2.1 Add repo-scoped GET pull-request list and detail routes plus `lib/pull-requests/rest-paths.ts` and `lib/pull-requests/rest-bootstrap.ts`, while preserving the existing CLI-facing repository-path list and edit behavior
- [ ] 2.2 Add shared owner and presentation helpers for repository PR hrefs, active-job polling decisions, and GitHub delegation link shaping

## 3. Repository PR Pages

- [ ] 3.1 Add `/${user}/${repo}/pull-requests` with repository validation, REST-only bootstrap, list-item links to PR detail pages, repository navigation, and polling only while active PR jobs remain
- [ ] 3.2 Add `/${user}/${repo}/pull-requests/[pullRequestId]` with repo-scoped REST bootstrap, PR metadata, activity timeline, CI/workflow history, and an `Open on GitHub` action with graceful fallback states

## 4. Verification

- [ ] 4.1 Add focused Vitest coverage for storage/service read models, activity shaping, result-artifact parsing, REST routes, page 404 behavior, REST-only bootstrap behavior, client link construction, and cross-repository isolation
- [ ] 4.2 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, targeted `pnpm test` coverage for PR pages/read models/routes, and `pnpm build`
