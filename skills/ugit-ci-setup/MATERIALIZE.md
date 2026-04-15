# Materialize the repo-local skill

This directory contains the authored payload for the `ugit-ci-setup` Codex
skill. The approved discovery path is still `.codex/skills/ugit-ci-setup/`.

In dedicated harness lanes, `.codex` is mounted read-only, so this checkout can
prepare the skill payload but cannot copy it into the final discovery path.

When you have a writable checkout, run:

```bash
./scripts/materialize-ugit-ci-skill.sh
```

The script fails fast when `.codex` is still mounted read-only. If you need the
manual equivalent, it performs:

```bash
rm -rf .codex/skills/ugit-ci-setup
mkdir -p .codex/skills/ugit-ci-setup
cp -R skills/ugit-ci-setup/. .codex/skills/ugit-ci-setup/
```

Then verify the repo-local skill path:

```bash
test -f .codex/skills/ugit-ci-setup/SKILL.md
pnpm exec vitest run lib/codex-skills.test.ts
```

If the checkout still cannot write `.codex`, stop there and fix the lane or use
another writable clone before asking for review again.
