#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/skills/ugit-ci-setup"
TARGET_PARENT="$REPO_ROOT/.codex/skills"
TARGET_DIR="$TARGET_PARENT/ugit-ci-setup"
WRITE_PROBE="$TARGET_PARENT/.ugit-ci-setup-write-probe.$$"

if [ ! -f "$SOURCE_DIR/SKILL.md" ]; then
  echo "Missing authored skill payload at $SOURCE_DIR" >&2
  exit 1
fi

if [ ! -d "$TARGET_PARENT" ]; then
  echo "Missing repo-local Codex skills directory at $TARGET_PARENT" >&2
  exit 1
fi

cleanup() {
  rm -f "$WRITE_PROBE"
}

trap cleanup EXIT INT TERM

if ! touch "$WRITE_PROBE" 2>/dev/null; then
  echo "Cannot write to $TARGET_PARENT." >&2
  echo "This checkout still mounts .codex read-only, so materialization must run from a writable clone." >&2
  if command -v findmnt >/dev/null 2>&1; then
    findmnt -T "$TARGET_PARENT" >&2 || true
  fi
  exit 1
fi

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp -R "$SOURCE_DIR/." "$TARGET_DIR/"

if [ ! -f "$TARGET_DIR/SKILL.md" ]; then
  echo "Materialization failed: $TARGET_DIR/SKILL.md is still missing." >&2
  exit 1
fi

echo "Materialized ugit-ci-setup into $TARGET_DIR"
echo "Next: pnpm exec vitest run lib/codex-skills.test.ts"
