#!/usr/bin/env bash
# Headless harness: Claude plans, implements, tests and reviews a feature using the project agents.
# Exit code is 0 only when typecheck, lint, tests AND the reviewer verdict all pass.
# Review/fix loops up to MAX_ROUNDS times, like the /add-feature skill.
#
# Usage: bash ./.claude/scripts/harness.sh "saved events: store them in Supabase instead of localStorage"
# Adapted for After (Windows/Git Bash friendly): JSON parsing uses node instead of python3.
set -euo pipefail
cd "$(dirname "$0")/../.."

FEATURE="${1:?Usage: harness.sh \"feature description\"}"
MAX_ROUNDS="${MAX_ROUNDS:-3}"
WORK="$(mktemp -d)"
RESULT=fail
# Keep plan, review and verify logs for debugging when the run does not succeed.
trap '[ "$RESULT" = ok ] && rm -rf "$WORK" || echo "Logs kept in $WORK" >&2' EXIT
HEADLESS="Headless run: nobody can answer questions or approve prompts. Never ask for permission. You may run npm install for dev dependencies (the script also installs before verifying). If a command is denied, do not stop: skip it, finish everything else you can, and list the denied command in your answer."
# Untrusted folders ignore permissions.allow, so the checks agents need are granted here explicitly.
# An array, never an unquoted string: each pattern contains spaces ("Bash(npm run test:*)") and word
# splitting would turn it into two invalid rules, so every Bash call would be denied.
# Agents chain commands ("cd server && npm test; echo EXIT: $?") and every part of a compound command must be
# allowed, so harmless helpers (echo, ls, pwd, head, tail) are listed too. npm install is allowed so test-writer
# can add test tooling; the script also installs before each verify.
CHECK_TOOLS=("Bash(echo:*)" "Bash(ls:*)" "Bash(pwd:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(npm install:*)" "Bash(npm pkg:*)" "Bash(mkdir:*)" "Bash(cd:*)" "Bash(git status:*)" "Bash(git diff:*)" "Bash(npm test:*)" "Bash(npx tsc:*)" "Bash(npx eslint:*)" "Bash(npx vitest:*)")
# Only the scripts the flow needs (never `npm run dev`, which hangs a headless run).
for WS in server client; do
  for SCRIPT in typecheck lint test build; do
    CHECK_TOOLS+=("Bash(npm --prefix $WS run $SCRIPT:*)" "Bash(npm run $SCRIPT:*)" "Bash(npm --prefix * run $SCRIPT*)")
  done
done
# Agents pass absolute --prefix paths and `npm test` without `run`; Next.js route types need `next typegen`.
CHECK_TOOLS+=("Bash(npm --prefix * test*)" "Bash(npx next typegen*)")
# The Stop hook would make these sessions fix failures on their own; the script runs its own verify.
export HARNESS_HEADLESS=1
PLAN="$WORK/plan.md"
REVIEW="$WORK/review.md"

# Runs `claude` with JSON output so permission denials are never lost in agent prose: the answer is printed as
# before, and every denied tool call is echoed as "DENIED> ..." (stderr) and summarized at the end of the run.
run_claude() {
  local out rc=0
  out="$(mktemp "$WORK/claude.XXXXXX")"
  claude "$@" --output-format json </dev/null >"$out" 2>"$out.err" || rc=$?
  [ -s "$out.err" ] && cat "$out.err" >&2
  node - "$out" "$WORK/denials.log" <<'NODE'
const fs = require("fs");
const [file, log] = process.argv.slice(2);
const raw = fs.readFileSync(file, "utf8");
let data;
try { data = JSON.parse(raw); } catch { console.log(raw); process.exit(0); }
console.log(data.result || "");
for (const denial of data.permission_denials || []) {
  const input = denial.tool_input || {};
  const detail = input.command || input.file_path || JSON.stringify(input);
  const line = "DENIED> " + denial.tool_name + ": " + detail;
  console.error(line);
  fs.appendFileSync(log, line + "\n");
}
NODE
  return $rc
}

if ! node -e '
const fs = require("fs"), os = require("os"), path = require("path");
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
  const projects = cfg.projects || {};
  const cwd = path.resolve(process.cwd()).toLowerCase();
  const key = Object.keys(projects).find((k) => path.resolve(k).toLowerCase() === cwd);
  process.exit(key && projects[key].hasTrustDialogAccepted ? 0 : 1);
} catch { process.exit(1); }
' 2>/dev/null; then
  echo "WARN: this folder is not trusted yet; permissions.allow will be ignored. Run 'claude' here once and accept the trust dialog." >&2
fi

# Installs run from the script, not from the agents: headless agents cannot get npm install approved
# (denied even with --allowedTools), but they can declare dependencies in package.json.
install_deps() {
  local rc=0
  for WORKSPACE in server client; do
    [ -f "$WORKSPACE/package.json" ] || continue
    has_changes "$WORKSPACE" || continue
    if ! (cd "$WORKSPACE" && npm install --no-audit --no-fund >"$WORK/install-$WORKSPACE.log" 2>&1); then
      echo "npm install FAILED in $WORKSPACE:"
      tail -n 15 "$WORK/install-$WORKSPACE.log"
      rc=1
    fi
  done
  return $rc
}

has_changes() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  # Second status column = working-tree changes; staged-only files (a checkpoint) do not count.
  [ -n "$(git status --porcelain -- "$1" 2>/dev/null | grep -v node_modules | grep -E '^.[^ ]')" ]
}

has_script() { grep -q "\"$1\"[[:space:]]*:" "$2/package.json"; }

# Runs typecheck, lint and tests only in workspaces with changes (an untouched workspace without a
# test script must not fail the run). Prints a PASS/FAIL/MISSING summary first, then the head of every
# failing step, so the reviewer never loses a result to a long test log.
verify() {
  local ok=0 summary="" details="" out step
  # Unchanged workspaces are not installed or checked; install errors are reported, not hidden.
  if ! out="$(install_deps)"; then
    summary+="install: FAIL"$'\n'; details+="$out"$'\n'; ok=1
  fi
  for WORKSPACE in server client; do
    [ -f "$WORKSPACE/package.json" ] || continue
    has_changes "$WORKSPACE" || { summary+="$WORKSPACE: unchanged, skipped"$'\n'; continue; }
    for step in typecheck lint test; do
      if ! has_script "$step" "$WORKSPACE"; then
        summary+="$WORKSPACE $step: MISSING script"$'\n'; ok=1; continue
      fi
      # npm run lint without an ESLint config fails for the wrong reason: report it as missing
      if [ "$step" = lint ] && ! ls "$WORKSPACE"/eslint.config.* "$WORKSPACE"/.eslintrc* >/dev/null 2>&1; then
        summary+="$WORKSPACE lint: MISSING eslint config"$'\n'; ok=1; continue
      fi
      out="$(cd "$WORKSPACE" && npm run "$step" --silent 2>&1)" && {
        summary+="$WORKSPACE $step: PASS"$'\n'
      } || {
        summary+="$WORKSPACE $step: FAIL"$'\n'; ok=1
        details+="--- $WORKSPACE $step (first 40 lines) ---"$'\n'"$(printf '%s\n' "$out" | head -n 40)"$'\n'
      }
    done
  done
  printf '%s\n%s\n' "$summary" "$details"
  return $ok
}

# Only an explicit "VERDICT:" line counts (the last one wins), so prose mentioning "APPROVED" cannot fool
# the script, and a missing verdict line counts as not approved.
verdict_approved() {
  local line
  line="$(grep -E '^[[:space:]*`]*VERDICT:' "$REVIEW" | tail -n1 | tr -d '[:space:]*`')"
  [ "$line" = "VERDICT:APPROVED" ]
}

echo "==> 1 Plan"
run_claude -p "Use the feature-planner agent to plan this feature: $FEATURE. Output only the plan." \
  --permission-mode plan --max-turns 20 | tee "$PLAN"

echo "==> 2 Implement server, then client"
run_claude -p "$HEADLESS Implement this plan. Run the server-writer agent first and, when it finishes, the client-writer agent. Plan:
$(cat "$PLAN")" \
  --permission-mode acceptEdits --allowedTools "${CHECK_TOOLS[@]}" --max-turns 40

echo "==> 3 Tests"
run_claude -p "$HEADLESS Run the test-writer agent to write tests for the feature that was just implemented. End your answer with exactly one line: 'BUGS: none' or 'BUGS: ' followed by the real production bugs it reported (file and behavior). Plan:
$(cat "$PLAN")" \
  --permission-mode acceptEdits --allowedTools "${CHECK_TOOLS[@]}" --max-turns 30 | tee "$WORK/tests.md"

# Real bugs found by the tests go to their owner agent before the review (like /add-feature does).
BUGS_LINE="$(grep -E '^[[:space:]*`]*BUGS:' "$WORK/tests.md" | tail -n1 | sed 's/^[[:space:]*`]*BUGS:[[:space:]]*//')"
if [ -n "$BUGS_LINE" ] && ! printf '%s' "$BUGS_LINE" | grep -qiE '^[[:space:]*`]*none'; then
  echo "==> 3b Fix bugs found by the tests"
  run_claude -p "$HEADLESS The tests found production bugs. Send each one to its owner agent (server-writer or client-writer) to fix, never to test-writer, then stop. Bugs: $BUGS_LINE" \
    --permission-mode acceptEdits --allowedTools "${CHECK_TOOLS[@]}" --max-turns 30
fi

APPROVED=0
for ROUND in $(seq 1 "$MAX_ROUNDS"); do
  echo "==> 4 Verify before review (round $ROUND/$MAX_ROUNDS)"
  verify > "$WORK/verify.log" 2>&1 || true
  cat "$WORK/verify.log"

  echo "==> 4 Review (round $ROUND/$MAX_ROUNDS)"
  # Not plan mode (it blocks Bash). Edit/Write are disallowed so the review stays read-only.
  run_claude -p "$HEADLESS Use the code-reviewer agent to review the current changes against the plan. Do not edit anything and do not fix issues. Reply with the reviewer's complete answer verbatim, ending with its VERDICT line, and add nothing after it. Latest typecheck/lint/test output (a failing check is a blocker):
$(cat "$WORK/verify.log")

Plan:
$(cat "$PLAN")" \
    --permission-mode acceptEdits --allowedTools "${CHECK_TOOLS[@]}" \
    --disallowedTools Edit Write NotebookEdit --max-turns 30 | tee "$REVIEW"

  if verdict_approved; then
    APPROVED=1
    break
  fi

  [ "$ROUND" -lt "$MAX_ROUNDS" ] || break
  echo "==> 4b Fix blockers"
  run_claude -p "$HEADLESS Fix every blocker in this review, sending each to its owner agent (server-writer, client-writer or test-writer), then stop. Review:
$(cat "$REVIEW")" \
    --permission-mode acceptEdits --allowedTools "${CHECK_TOOLS[@]}" --max-turns 40
done

echo "==> 5 Verify (typecheck + lint + tests)"
VERIFIED=0
verify > "$WORK/verify.log" 2>&1 || VERIFIED=1
cat "$WORK/verify.log"

if [ -s "$WORK/denials.log" ]; then
  echo "==> Denied tool calls (add them to CHECK_TOOLS if they are safe)"
  sort "$WORK/denials.log" | uniq -c | sort -rn
fi

if [ "$APPROVED" -eq 1 ] && [ "$VERIFIED" -eq 0 ]; then
  RESULT=ok
  echo "OK: feature implemented"
else
  echo "FAIL: approved=$APPROVED verify_failed=$VERIFIED"
  exit 1
fi
