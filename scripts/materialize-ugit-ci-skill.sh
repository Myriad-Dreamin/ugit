#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE_PREFIX="skills/ugit-ci-setup"
SOURCE_DIR="$REPO_ROOT/$SOURCE_PREFIX"
DESTINATION_INPUT="${1:-.codex/skills/ugit-ci-setup}"
REQUIRED_FILES="
SKILL.md
references/workflow-contract.md
references/remote-validation.md
templates/package.json.template.json
templates/run-ugit-ci.sh.template
"

case "$DESTINATION_INPUT" in
  /*)
    DESTINATION_DIR="$DESTINATION_INPUT"
    ;;
  *)
    DESTINATION_DIR="$REPO_ROOT/$DESTINATION_INPUT"
    ;;
esac

DESTINATION_PARENT="$(dirname "$DESTINATION_DIR")"

probe_write_path() {
  target_path="$1"
  failure_message="$2"
  probe_path="$target_path/.ugit-ci-setup-write-check.$$"

  if ! touch "$probe_path" >/dev/null 2>&1; then
    echo "$failure_message" >&2
    if command -v findmnt >/dev/null 2>&1; then
      findmnt -T "$target_path" >&2 || true
    fi
    exit 1
  fi

  rm -f "$probe_path"
}

if [ -e "$DESTINATION_DIR" ] && [ ! -d "$DESTINATION_DIR" ]; then
  echo "Destination exists but is not a directory: $DESTINATION_DIR" >&2
  exit 1
fi

mkdir -p "$DESTINATION_PARENT"
probe_write_path "$DESTINATION_PARENT" "Cannot write to $DESTINATION_PARENT."

rm -rf "$DESTINATION_DIR"
mkdir -p "$DESTINATION_DIR"

printf '%s\n' "$REQUIRED_FILES" | while IFS= read -r relative_path; do
  [ -n "$relative_path" ] || continue

  source_path="$SOURCE_DIR/$relative_path"
  destination_path="$DESTINATION_DIR/$relative_path"

  if [ ! -f "$source_path" ]; then
    echo "Missing required authored skill file at $source_path" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$destination_path")"
  cp "$source_path" "$destination_path"

  printf "copied %s from %s\n" "$destination_path" "$SOURCE_PREFIX/$relative_path"
done

echo "Materialized ugit-ci-setup into $DESTINATION_DIR"
