#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): lint ONLY the edited file.
# Full typecheck is deliberately not run here: writers build bottom-up (types -> repository -> ...),
# so intermediate states do not compile. The full typecheck runs in the Stop hook and in /verify.
# Does nothing when the workspace, eslint, an eslint config or the file do not exist.
# Exit 2 sends the output back to Claude so it fixes the problem.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Prints "<workspace>\t<absolute file>" for lintable files under client/ or server/, nothing otherwise.
# Done in node so Windows paths (backslashes, drive letters) are handled correctly.
TARGET="$(ROOT="$ROOT" node -e '
const path = require("path");
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  let file = "";
  try { file = (JSON.parse(raw).tool_input || {}).file_path || ""; } catch { return; }
  if (!file || !/\.(ts|tsx|js|jsx|mjs)$/.test(file)) return;
  const rel = path.relative(process.env.ROOT, path.resolve(file)).split(path.sep);
  if (rel[0] === "client" || rel[0] === "server") {
    process.stdout.write(rel[0] + "\t" + path.resolve(file));
  }
});
' 2>/dev/null)"

[ -n "$TARGET" ] || exit 0
WORKSPACE="${TARGET%%$'\t'*}"
FILE="${TARGET#*$'\t'}"
DIR="$ROOT/$WORKSPACE"

[ -f "$FILE" ] || exit 0
[ -f "$DIR/package.json" ] || exit 0
[ -e "$DIR/node_modules/.bin/eslint" ] || exit 0
ls "$DIR"/eslint.config.* "$DIR"/.eslintrc* >/dev/null 2>&1 || exit 0

cd "$DIR" || exit 0
"$DIR/node_modules/.bin/eslint" "$FILE" 1>&2 || exit 2

exit 0
