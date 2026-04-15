# Repo-local skill checkout notes

This directory is the authored source payload for the `ugit-ci-setup` Codex
skill. The repo-local discovery path remains `.codex/skills/ugit-ci-setup/`.

This branch is only complete when the same required files also exist under
`.codex/skills/ugit-ci-setup`.

Refresh that discovery path from a writable checkout with:

```bash
./scripts/sync-ugit-ci-skill.sh
```

The helper copies the authored payload into `.codex/skills/ugit-ci-setup`,
stages the repo-local skill files, and fails fast with mount diagnostics when
`.codex` or `.git` is read-only.

Then validate the repo-local skill with:

```bash
pnpm exec vitest run lib/codex-skills.test.ts
```
