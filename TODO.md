---
name: TODO list of ugit
description: Each item in this list should be actionable and ideally linked to a specific code change or issue. Each item must describe the scope like "X component in Y folder" to make it clear which part of the codebase it relates to. It MUST not only restrict scope by file path because the files may be changed or moved, but also by component or functionality.
license: Apache-2.0
---

## Items

- Materialize and commit the repo-local `ugit-ci-setup` Codex skill discovery
  path in a writable checkout so `.codex/skills/ugit-ci-setup` exists in the
  repository tree; this lane still cannot update `.codex` or the shared Git
  metadata because both mounts are read-only, so use
  `./scripts/export-ugit-ci-skill-patch.sh` or
  `./scripts/sync-ugit-ci-skill.sh --repo-root /path/to/writable-checkout`
  from a writable checkout to land the shipped discovery requirement.
- Expand the landing page starter experience so the home screen explains the default app structure and validation commands for new contributors.
