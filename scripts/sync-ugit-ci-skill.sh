#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
DISCOVERY_PREFIX=".codex/skills/ugit-ci-setup"
SOURCE_PREFIX="skills/ugit-ci-setup"
SOURCE_DIR="$REPO_ROOT/$SOURCE_PREFIX"
REQUIRED_FILES="
SKILL.md
references/workflow-contract.md
references/remote-validation.md
templates/package.json.template.json
templates/run-ugit-ci.sh.template
"

cd "$REPO_ROOT"

GIT_DIR="$(git rev-parse --git-dir)"
INDEX_LOCK="$GIT_DIR/index.lock"

if ! touch "$INDEX_LOCK" 2>/dev/null; then
  echo "Cannot write to $GIT_DIR." >&2
  echo "Run this helper from a writable checkout so Git can stage the .codex discovery payload." >&2
  if command -v findmnt >/dev/null 2>&1; then
    findmnt -T "$GIT_DIR" >&2 || true
  fi
  exit 1
fi

rm -f "$INDEX_LOCK"

git ls-files "$DISCOVERY_PREFIX" | while IFS= read -r tracked_path; do
  [ -n "$tracked_path" ] || continue
  git update-index --force-remove "$tracked_path"
done

printf '%s' "$REQUIRED_FILES" | while IFS= read -r relative_path; do
  [ -n "$relative_path" ] || continue
  source_path="$SOURCE_DIR/$relative_path"
  discovery_path="$DISCOVERY_PREFIX/$relative_path"
  index_entry="$(git ls-files -s -- "$SOURCE_PREFIX/$relative_path")"

  if [ ! -f "$source_path" ]; then
    echo "Missing required authored skill file at $source_path" >&2
    exit 1
  fi

  if [ -z "$index_entry" ]; then
    echo "Missing tracked Git entry for $SOURCE_PREFIX/$relative_path" >&2
    echo "Stage that source file in a writable checkout before syncing the discovery path." >&2
    exit 1
  fi

  set -- $index_entry
  mode="$1"
  blob_id="$2"

  git update-index --add --cacheinfo "$mode" "$blob_id" "$discovery_path"
  git update-index --skip-worktree "$discovery_path"

  printf "tracked %s from %s\n" "$discovery_path" "$SOURCE_PREFIX/$relative_path"
done

echo "Synced $DISCOVERY_PREFIX from $SOURCE_PREFIX"
echo "Next: pnpm exec vitest run lib/codex-skills.test.ts"
