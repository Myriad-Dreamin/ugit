#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
DISCOVERY_PREFIX=".codex/skills/ugit-ci-setup"
SKIP_GIT_ADD=0
TARGET_REPO_ROOT="$REPO_ROOT"

usage() {
  echo "Usage: ./scripts/sync-ugit-ci-skill.sh [--repo-root <path>] [--skip-git-add]" >&2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-git-add)
      SKIP_GIT_ADD=1
      shift
      ;;
    --repo-root)
      if [ "$#" -lt 2 ]; then
        usage
        exit 1
      fi
      TARGET_REPO_ROOT="$2"
      shift 2
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

case "$TARGET_REPO_ROOT" in
  /*) ;;
  *) TARGET_REPO_ROOT="$REPO_ROOT/$TARGET_REPO_ROOT" ;;
esac

cd "$REPO_ROOT"

DISCOVERY_DESTINATION="$TARGET_REPO_ROOT/$DISCOVERY_PREFIX"

if ! "$SCRIPT_DIR/materialize-ugit-ci-skill.sh" "$DISCOVERY_DESTINATION"; then
  echo "If the destination checkout mounts .codex or .git read-only, write the lane-local discovery mirror instead:" >&2
  echo "  ./scripts/track-ugit-ci-skill.sh --repo-root $TARGET_REPO_ROOT" >&2
  exit 1
fi

if [ "$SKIP_GIT_ADD" -eq 1 ]; then
  echo "Skipped git add for $DISCOVERY_DESTINATION"
  echo "Next: pnpm exec vitest run lib/codex-skills.test.ts"
  exit 0
fi

if ! git -C "$TARGET_REPO_ROOT" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Target repo root is not a Git checkout: $TARGET_REPO_ROOT" >&2
  echo "Use ./scripts/materialize-ugit-ci-skill.sh for arbitrary non-Git destinations." >&2
  exit 1
fi

GIT_DIR="$(git -C "$TARGET_REPO_ROOT" rev-parse --absolute-git-dir)"
INDEX_LOCK="$GIT_DIR/index.lock"

if ! touch "$INDEX_LOCK" 2>/dev/null; then
  echo "Materialized $DISCOVERY_DESTINATION but cannot write to $GIT_DIR." >&2
  echo "Stage the repo-local skill files from a writable checkout with:" >&2
  echo "  git -C $TARGET_REPO_ROOT add -A $DISCOVERY_PREFIX" >&2
  if command -v findmnt >/dev/null 2>&1; then
    findmnt -T "$GIT_DIR" >&2 || true
  fi
  exit 1
fi

rm -f "$INDEX_LOCK"

git -C "$TARGET_REPO_ROOT" add -A "$DISCOVERY_PREFIX"

echo "Synced $DISCOVERY_PREFIX into $TARGET_REPO_ROOT from skills/ugit-ci-setup and staged the repo-local skill files"
echo "Next: pnpm exec vitest run lib/codex-skills.test.ts"
