# Repo-local skill checkout notes

This directory is the authored source payload for the `ugit-ci-setup` Codex
skill. The repo-local discovery path remains `.codex/skills/ugit-ci-setup/`.

This branch is only complete when the same required files also exist under
`.codex/skills/ugit-ci-setup`.

Refresh that discovery path from a writable checkout with:

```bash
./scripts/sync-ugit-ci-skill.sh
```

Or target another writable checkout directly from this lane with:

```bash
./scripts/sync-ugit-ci-skill.sh --repo-root /path/to/checkout
```

To materialize the skill into another writable checkout or an arbitrary
temporary discovery root without staging, run:

```bash
./scripts/materialize-ugit-ci-skill.sh /path/to/checkout/.codex/skills/ugit-ci-setup
```

`./scripts/sync-ugit-ci-skill.sh` now reuses that copy helper, can target
another checkout with `--repo-root`, stages the repo-local skill files, and
fails fast with mount diagnostics when `.codex` or `.git` is read-only. Pass
`--skip-git-add` if you only need the in-place `.codex` copy refreshed.

Then validate the repo-local skill with:

```bash
pnpm exec vitest run lib/codex-skills.test.ts
```

If you only need to smoke-test the authored payload from a read-only harness
lane, run:

```bash
./scripts/smoke-ugit-ci-skill.sh
```

That helper materializes the same required files into a temporary writable
`.codex` path, reuses `lib/codex-skills.test.ts` against that temp discovery
tree, scaffolds a temporary `.ugit/workflows/ci` package from the committed
templates, and runs `pnpm --dir <temp>/.ugit/workflows/ci run ugit:ci`.
