#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/skills/ugit-ci-setup"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ugit-ci-skill-smoke.XXXXXX")"
DISCOVERY_DIR="$TEMP_ROOT/.codex/skills/ugit-ci-setup"
FIXTURE_REPO="$TEMP_ROOT/repo"
WORKFLOW_DIR="$FIXTURE_REPO/.ugit/workflows/ci"

cleanup() {
  rm -rf "$TEMP_ROOT"
}

trap cleanup EXIT HUP INT TERM

mkdir -p "$DISCOVERY_DIR/references" "$DISCOVERY_DIR/templates"

for relative_path in \
  SKILL.md \
  references/workflow-contract.md \
  references/remote-validation.md \
  templates/package.json.template.json \
  templates/run-ugit-ci.sh.template
do
  cp "$SOURCE_DIR/$relative_path" "$DISCOVERY_DIR/$relative_path"
done

cd "$REPO_ROOT"

CODEX_SKILLS_DISCOVERY_PREFIX="$DISCOVERY_DIR" \
  pnpm exec vitest run lib/codex-skills.test.ts

mkdir -p "$WORKFLOW_DIR"

(
  cd "$FIXTURE_REPO"
  git init -q
)

sed "s/__WORKFLOW_NAME__/ci/g" \
  "$SOURCE_DIR/templates/package.json.template.json" \
  > "$WORKFLOW_DIR/package.json"

sed "s|__UGIT_CI_COMMAND__|printf 'smoke-ok\\\\n'|" \
  "$SOURCE_DIR/templates/run-ugit-ci.sh.template" \
  > "$WORKFLOW_DIR/run-ugit-ci.sh"

chmod +x "$WORKFLOW_DIR/run-ugit-ci.sh"

WORKFLOW_OUTPUT="$(pnpm --dir "$WORKFLOW_DIR" run ugit:ci)"

printf '%s\n' "$WORKFLOW_OUTPUT"

case "$WORKFLOW_OUTPUT" in
  *smoke-ok*) ;;
  *)
    echo "Expected smoke-ok output from pnpm --dir $WORKFLOW_DIR run ugit:ci" >&2
    exit 1
    ;;
esac

echo "Smoke validation passed with temporary .codex materialization at $DISCOVERY_DIR"
