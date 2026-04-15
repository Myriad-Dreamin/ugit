#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
DISCOVERY_PREFIX=".codex/skills/ugit-ci-setup"
DISCOVERY_DIR="$REPO_ROOT/$DISCOVERY_PREFIX"
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

probe_write_path() {
  target_path="$1"
  failure_message="$2"
  probe_path="$target_path/.ugit-ci-setup-write-check.$$"

  if ! : > "$probe_path" 2>/dev/null; then
    echo "$failure_message" >&2
    if command -v findmnt >/dev/null 2>&1; then
      findmnt -T "$target_path" >&2 || true
    fi
    exit 1
  fi

  rm -f "$probe_path"
}

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

probe_write_path "$REPO_ROOT/.codex/skills" "Cannot write to $REPO_ROOT/.codex/skills."

rm -rf "$DISCOVERY_DIR"
mkdir -p "$DISCOVERY_DIR"

printf '%s\n' "$REQUIRED_FILES" | while IFS= read -r relative_path; do
  [ -n "$relative_path" ] || continue
  source_path="$SOURCE_DIR/$relative_path"
  discovery_path="$DISCOVERY_PREFIX/$relative_path"
  discovery_abspath="$REPO_ROOT/$discovery_path"

  if [ ! -f "$source_path" ]; then
    echo "Missing required authored skill file at $source_path" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$discovery_abspath")"
  cp "$source_path" "$discovery_abspath"

  printf "copied %s from %s\n" "$discovery_path" "$SOURCE_PREFIX/$relative_path"
done

git add -A "$DISCOVERY_PREFIX"

echo "Synced $DISCOVERY_PREFIX from $SOURCE_PREFIX and staged the repo-local skill files"
echo "Next: pnpm exec vitest run lib/codex-skills.test.ts"
