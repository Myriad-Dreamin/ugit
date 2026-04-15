#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
TARGET_REPO_ROOT="$REPO_ROOT"
OUTPUT_PATH=""
TEMP_ROOT=""

usage() {
  echo "Usage: ./scripts/export-ugit-ci-skill-patch.sh [--repo-root <path>] [--output <path>]" >&2
}

cleanup() {
  if [ -n "$TEMP_ROOT" ] && [ -d "$TEMP_ROOT" ]; then
    rm -rf "$TEMP_ROOT"
  fi
}

trap cleanup EXIT INT TERM

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
    --output)
      if [ "$#" -lt 2 ]; then
        usage
        exit 1
      fi
      OUTPUT_PATH="$2"
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

if ! git -C "$TARGET_REPO_ROOT" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Target repo root is not a Git checkout: $TARGET_REPO_ROOT" >&2
  exit 1
fi

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ugit-ci-skill-patch.XXXXXX")"

"$SCRIPT_DIR/materialize-ugit-ci-skill.sh" "$TEMP_ROOT/.codex/skills/ugit-ci-setup" >/dev/null

emit_patch() {
  relative_path="$1"
  target_path=".codex/skills/ugit-ci-setup/$relative_path"

  set +e
  git -C "$TEMP_ROOT" diff --no-index --binary \
    --src-prefix=a/ --dst-prefix=b/ \
    /dev/null "$target_path"
  status="$?"
  set -e

  if [ "$status" -gt 1 ]; then
    return "$status"
  fi
}

REQUIRED_FILES="
SKILL.md
references/workflow-contract.md
references/remote-validation.md
templates/package.json.template.json
templates/run-ugit-ci.sh.template
"

write_patch() {
  for relative_path in $REQUIRED_FILES; do
    emit_patch "$relative_path"
  done
}

if [ -n "$OUTPUT_PATH" ]; then
  case "$OUTPUT_PATH" in
    /*) ;;
    *) OUTPUT_PATH="$TARGET_REPO_ROOT/$OUTPUT_PATH" ;;
  esac

  mkdir -p "$(dirname "$OUTPUT_PATH")"
  write_patch >"$OUTPUT_PATH"
  echo "Wrote ugit-ci-setup discovery patch to $OUTPUT_PATH"
  echo "Next from a writable checkout: git apply $OUTPUT_PATH && git add .codex/skills/ugit-ci-setup"
  exit 0
fi

write_patch
