## 1. Scope Alignment

- [x] 1.1 Confirm the approved change keeps the canonical request/PR title `fix(cli/create): prompt before overriding origin remote` and conventional-title metadata `fix(cli/create)` without altering the assigned change path
- [x] 1.2 Review the current `ugit create` command and repository creation flow so the implementation stays limited to origin-conflict handling, focused tests, and documentation

## 2. Origin Conflict Flow

- [x] 2.1 Add a create-command option such as `--override-origin`, detect conflicting local `origin` remotes in the command layer, and prompt only for interactive runs
- [x] 2.2 Pass an explicit conflict-resolution choice into `createRepository` so approved conflicts replace `origin` with the computed ugit URL, declined conflicts abort cleanly, and already-correct `origin` remotes keep existing behavior
- [x] 2.3 Keep non-interactive `ugit create` runs deterministic by refusing origin replacement without the explicit override flag and by surfacing actionable guidance in help or error output

## 3. Verification

- [x] 3.1 Add focused Vitest coverage for interactive accept, interactive decline, explicit override, and non-interactive refusal paths across the command and repository layers
- [x] 3.2 Update `README.md` and CLI help text to document the origin-override prompt and scripting-safe override flag
- [x] 3.3 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and `pnpm build`
