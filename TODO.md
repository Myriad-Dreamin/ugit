---
name: TODO list of ugit
description: Each item in this list should be actionable and ideally linked to a specific code change or issue. Each item must describe the scope like "X component in Y folder" to make it clear which part of the codebase it relates to. It MUST not only restrict scope by file path because the files may be changed or moved, but also by component or functionality.
license: Apache-2.0
---

## Items

- Materialize the repo-local `ugit-ci-setup` Codex skill discovery path for
  CI scaffolding by running
  `./scripts/sync-ugit-ci-skill.sh --repo-root <writable-checkout>` so the
  writable checkout receives the committed
  `.codex/skills/ugit-ci-setup` payload, stages it, and lets the default
  `lib/codex-skills.test.ts` path pass without the temporary smoke helper.
- Expand the landing page starter experience so the home screen explains the default app structure and validation commands for new contributors.
