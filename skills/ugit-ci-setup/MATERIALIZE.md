# Repo-local skill checkout notes

This directory is the authored source payload for the `ugit-ci-setup` Codex
skill. The repo-local discovery path remains `.codex/skills/ugit-ci-setup/`.

The repository mirrors the required skill files into
`.codex/skills/ugit-ci-setup` through tracked Git entries so normal checkouts
expose the repo-local skill at the documented discovery path.

Dedicated harness lanes may mount `.codex` read-only. In those lanes the
checked-out `.codex` files can stay hidden even though the Git tree still
contains the discovery-path payload.

Validate the tracked repo-local skill with:

```bash
pnpm exec vitest run lib/codex-skills.test.ts
```

If you change one of the tracked skill files, refresh the `.codex` payload
from a writable checkout with:

```bash
./scripts/sync-ugit-ci-skill.sh
```

Then verify the discovery path again:

```bash
pnpm exec vitest run lib/codex-skills.test.ts
```
