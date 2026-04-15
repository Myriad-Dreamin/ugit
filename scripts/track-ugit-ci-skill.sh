#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE_PREFIX="skills/ugit-ci-setup"
TARGET_REPO_ROOT="$REPO_ROOT"
MIRROR_ROOT=""

usage() {
  echo "Usage: ./scripts/track-ugit-ci-skill.sh [--repo-root <path>] [--mirror-root <path>]" >&2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo-root)
      if [ "$#" -lt 2 ]; then
        usage
        exit 1
      fi
      TARGET_REPO_ROOT="$2"
      shift 2
      ;;
    --mirror-root)
      if [ "$#" -lt 2 ]; then
        usage
        exit 1
      fi
      MIRROR_ROOT="$2"
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

if [ -z "$MIRROR_ROOT" ]; then
  MIRROR_ROOT="$TARGET_REPO_ROOT/.data/codex-skills/ugit-ci-setup"
fi

case "$MIRROR_ROOT" in
  /*) ;;
  *) MIRROR_ROOT="$REPO_ROOT/$MIRROR_ROOT" ;;
esac

if ! git -C "$TARGET_REPO_ROOT" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Target repo root is not a Git checkout: $TARGET_REPO_ROOT" >&2
  exit 1
fi

if ! "$SCRIPT_DIR/materialize-ugit-ci-skill.sh" "$MIRROR_ROOT"; then
  echo "Cannot write the lane-local discovery mirror at $MIRROR_ROOT" >&2
  exit 1
fi

echo "Wrote a lane-local ugit-ci-setup discovery mirror to $MIRROR_ROOT"
echo "Next: pnpm exec vitest run lib/codex-skills.test.ts"
