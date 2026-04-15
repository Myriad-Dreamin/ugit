# Repo-local skill checkout notes

This directory is the authored source payload for the `ugit-ci-setup` Codex
skill. The repo-local discovery path remains `.codex/skills/ugit-ci-setup/`.

This branch is only complete when the same required files also exist under
`.codex/skills/ugit-ci-setup`.

If the current checkout mounts `.codex` and `.git` read-only, write a
lane-local discovery mirror with:

```bash
./scripts/track-ugit-ci-skill.sh
```

Refresh that discovery path from a writable checkout with:

```bash
./scripts/sync-ugit-ci-skill.sh
```

Or target another writable checkout directly from this lane with:

```bash
./scripts/sync-ugit-ci-skill.sh --repo-root /path/to/checkout
```

If this lane cannot write `.codex` or `.git` but you need a patch that another
writable checkout can apply directly, run:

```bash
./scripts/export-ugit-ci-skill-patch.sh --output .data/codex-skills/ugit-ci-setup.patch
```

To materialize the skill into another writable checkout or an arbitrary
temporary discovery root without staging, run:

```bash
./scripts/materialize-ugit-ci-skill.sh /path/to/checkout/.codex/skills/ugit-ci-setup
```

`./scripts/sync-ugit-ci-skill.sh` now reuses that copy helper, can target
another checkout with `--repo-root`, stages the repo-local skill files, and
points back to `./scripts/track-ugit-ci-skill.sh` when `.codex` is mounted
read-only. Pass `--skip-git-add` if you only need the in-place `.codex` copy
refreshed.

`./scripts/track-ugit-ci-skill.sh` writes a lane-local discovery mirror tree
at `.data/codex-skills/ugit-ci-setup/` without touching the mounted
`.codex` or `.git` paths. It prints a
`CODEX_SKILLS_DISCOVERY_PREFIX=<mirror> pnpm exec vitest run lib/codex-skills.test.ts`
command for an explicit mirror parity check, but that mirror does not replace
the required committed `.codex/skills/ugit-ci-setup` payload.

`./scripts/export-ugit-ci-skill-patch.sh` materializes the same required files
into a temporary writable tree and emits a `git apply` patch that adds
`.codex/skills/ugit-ci-setup` from a writable checkout without retyping the
file list.

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
