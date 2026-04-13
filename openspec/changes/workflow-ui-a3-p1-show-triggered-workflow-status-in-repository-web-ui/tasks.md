## 1. Repository Workflow Summary Helper

- [ ] 1.1 Add a server-only helper under `lib/` that discovers repository-scoped CI result artifacts, parses valid summaries defensively, and normalizes branch workflow summaries newest first.
- [ ] 1.2 Reuse repository pull request `latestJob` state to surface queued and running branches before a replacement artifact exists, including the defined branch-level precedence over older finished artifacts.

## 2. Repository Page Rendering

- [ ] 2.1 Extend `app/[user]/[repo]/page.tsx` to render a workflow-status panel without regressing the existing repository-root entry list.
- [ ] 2.2 Render branch name, short commit hash, overall status, per-workflow rows, and queued, started, and finished timestamps, including explicit empty, queued, running, succeeded, failed, and mixed-result states.

## 3. Focused Test Coverage

- [ ] 3.1 Add Vitest coverage for repository scoping, malformed artifact handling, deterministic ordering, slash-delimited branch artifact discovery, and active-job fallback and precedence.
- [ ] 3.2 Update repository page tests to cover empty and populated workflow rendering while keeping the current owner validation and missing-repository behavior intact.

## 4. Validation

- [ ] 4.1 Run `pnpm fmt` and `pnpm fmt:check`.
- [ ] 4.2 Run `pnpm lint`, `pnpm test`, and `pnpm build`.
