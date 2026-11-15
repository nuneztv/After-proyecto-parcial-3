#!/usr/bin/env bash
# Stop hook: typecheck + lint + tests for every workspace (server, client) that has uncommitted changes.
# - Skips workspaces with no changes (pure Q&A turns cost nothing). Without git, it always runs.
# - A missing script (or lint without an ESLint config) is reported on stderr as a warning, never silently.
# - Exit 2 keeps Claude working until checks pass. On the second stop (stop_hook_active) it still runs the
#   checks but lets Claude stop, printing a loud warning if they fail (loop guard).
# - HARNESS_HEADLESS=1 (set by harness.sh) disables it: the script runs its own verify.
set -uo pipefail

[ "${HARNESS_HEADLESS:-}" = "1" ] && exit 0

INPUT="$(cat)"
ACTIVE=0
if printf '%s' "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  ACTIVE=1
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATUS=0

has_script() { grep -q "\"$1\"[[:space:]]*:" "$2/package.json"; }
has_eslint_config() { ls "$1"/eslint.config.* "$1"/.eslintrc* >/dev/null 2>&1; }

has_changes() {
  git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  [ -n "$(git -C "$ROOT" status --porcelain -- "$1" 2>/dev/null | grep -v node_modules)" ]
}

for WORKSPACE in server client; do
  DIR="$ROOT/$WORKSPACE"
  [ -f "$DIR/package.json" ] || continue
  [ -d "$DIR/node_modules" ] || continue
  has_changes "$WORKSPACE" || continue

  for STEP in typecheck lint test; do
    if ! has_script "$STEP" "$DIR"; then
      echo "warning: $WORKSPACE has no \"$STEP\" script, check skipped" 1>&2
      continue
    fi
    if [ "$STEP" = "lint" ] && ! has_eslint_config "$DIR"; then
      echo "warning: $WORKSPACE has a lint script but no eslint.config.*, check skipped" 1>&2
      continue
    fi
    if [ "$STEP" = "test" ] && grep -q 'no test specified' "$DIR/package.json"; then
      echo "warning: $WORKSPACE test script is the npm placeholder, check skipped" 1>&2
      continue
    fi
    echo "==> $STEP: $WORKSPACE" 1>&2
    (cd "$DIR" && npm run "$STEP" --silent 1>&2) || STATUS=2
  done
done

if [ "$STATUS" -ne 0 ] && [ "$ACTIVE" -eq 1 ]; then
  echo "WARNING: stopping with failing checks (second stop, loop guard). The task is NOT done: report which checks fail." 1>&2
  exit 0
fi

exit $STATUS
