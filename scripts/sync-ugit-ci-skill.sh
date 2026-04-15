#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
DISCOVERY_PREFIX=".codex/skills/ugit-ci-setup"
SKIP_GIT_ADD=0

if [ "${1:-}" = "--skip-git-add" ]; then
  SKIP_GIT_ADD=1
  shift
fi

if [ "$#" -ne 0 ]; then
  echo "Usage: ./scripts/sync-ugit-ci-skill.sh [--skip-git-add]" >&2
  exit 1
fi

cd "$REPO_ROOT"

"$SCRIPT_DIR/materialize-ugit-ci-skill.sh" "$DISCOVERY_PREFIX"

if [ "$SKIP_GIT_ADD" -eq 1 ]; then
  echo "Skipped git add for $DISCOVERY_PREFIX"
  echo "Next: pnpm exec vitest run lib/codex-skills.test.ts"
  exit 0
fi

GIT_DIR="$(git rev-parse --git-dir)"
INDEX_LOCK="$GIT_DIR/index.lock"

if ! touch "$INDEX_LOCK" 2>/dev/null; then
  echo "Materialized $DISCOVERY_PREFIX but cannot write to $GIT_DIR." >&2
  echo "Stage the repo-local skill files from a writable checkout with:" >&2
  echo "  git add -A $DISCOVERY_PREFIX" >&2
  if command -v findmnt >/dev/null 2>&1; then
    findmnt -T "$GIT_DIR" >&2 || true
  fi
  exit 1
fi

rm -f "$INDEX_LOCK"

git add -A "$DISCOVERY_PREFIX"

echo "Synced $DISCOVERY_PREFIX from skills/ugit-ci-setup and staged the repo-local skill files"
echo "Next: pnpm exec vitest run lib/codex-skills.test.ts"
