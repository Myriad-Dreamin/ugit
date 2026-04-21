## 1. Proposal Alignment

- [x] 1.1 Preserve the canonical title `refactor(github/merge): switch GitHub merge adapter to gh` and conventional metadata `refactor(github/merge)` throughout this change
- [x] 1.2 Keep repository PR detail reads and merge actions behind repo-scoped REST while planning the server-only `gh` transport swap

## 2. Server-only gh Adapter

- [x] 2.1 Refactor `lib/pull-requests/github.ts` into an injectable `gh` command bridge that preserves remote discovery and GitHub compare-link behavior
- [x] 2.2 Replace canonical PR lookup and approved merge execution with explicit-repository `gh` commands that preserve the current metadata shape, squash-only merge semantics, and head-SHA guard

## 3. Manual Merge Integration

- [x] 3.1 Wire `lib/pr-runner/manual-merge.ts` and `lib/pr-runner/service.ts` to the new `gh` adapter and remove `UGIT_GITHUB_TOKEN` or raw-fetch happy-path dependencies
- [x] 3.2 Fail closed on missing `gh`, failed auth, missing PR metadata, malformed JSON, and merge rejection while returning actionable `gh auth login` or `gh auth status` guidance

## 4. Docs, Tests, And Validation

- [x] 4.1 Update README guidance, service messages, and UI or test expectations from `UGIT_GITHUB_TOKEN` setup to `gh auth login` and `gh auth status`
- [x] 4.2 Add focused regression coverage for command runner stubs, canonical lookup success, missing PR metadata, missing `gh`, auth failure, malformed JSON, merge conflict or head mismatch, and command-start failures
- [x] 4.3 Validate with `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`
