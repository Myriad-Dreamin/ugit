## 1. CLI Mode Selection

- [ ] 1.1 Extend `WorkflowRunCommand` with `--local`, preserve the current
  remote queue path as the default, and reject `--local` together with
  `--machine` or `--port`
- [ ] 1.2 Add a local workflow execution path that resolves only the repository
  root, skips machine or server interactions, and shares or mirrors the
  workflow-package validation plus command construction contract used by the
  remote runner

## 2. Foreground Execution Lifecycle

- [ ] 2.1 Run local workflow install and `ugit:ci` steps as foreground child
  processes attached to the current terminal, propagate their exit result, and
  forward `SIGINT`, `SIGTERM`, and `SIGHUP` to the active child
- [ ] 2.2 Keep the remote workflow path unchanged when `--local` is absent,
  including machine resolution, branch publishing, queueing, and workflow ID
  output

## 3. Documentation and Verification

- [ ] 3.1 Update CLI help text and `README.md` to explain the local-versus-remote
  split, local dependency-cache side effects, and the fact that
  `ugit workflow logs` applies only to remote queued runs
- [ ] 3.2 Add focused Vitest coverage for argument parsing, local-versus-remote
  path selection, incompatible flag rejection, local executor command
  construction, and exit or signal propagation
- [ ] 3.3 Run `pnpm fmt`, `pnpm fmt:check`, `pnpm lint`, `pnpm test`, and
  `pnpm build`
