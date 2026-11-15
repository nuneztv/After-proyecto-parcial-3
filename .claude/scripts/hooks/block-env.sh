#!/usr/bin/env bash
# PreToolUse hook (Bash|Read|Edit|Write|Grep|Glob): block any tool call that touches a real .env file.
# Permission deny rules only match exact commands (`head .env` or `rm -fr` slip through); this inspects the
# whole command or path. `.env.example` (and .sample/.template) stay allowed.
# Uses node (always installed in this repo) instead of python3: on Windows `python3` is often only the
# Microsoft Store alias.
# Exit 2 blocks the call and sends the message back to Claude.
set -uo pipefail

node -e '
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  const input = (data && data.tool_input) || {};
  const text = ["command", "file_path", "path", "pattern", "glob"]
    .map((key) => String(input[key] ?? ""))
    .join(" ");
  // .env, .env.local, .env.production, ... but not .env.example/.sample/.template
  const re = /(?<![A-Za-z0-9_])\.env(\.[A-Za-z0-9_-]+)?(?![A-Za-z0-9_-])/g;
  for (const match of text.matchAll(re)) {
    const suffix = (match[1] || "").replace(/^\./, "");
    if (!["example", "sample", "template"].includes(suffix)) {
      process.stderr.write("Blocked: .env files hold secrets and are off limits. Use .env.example instead.\n");
      process.exit(2);
    }
  }
  process.exit(0);
});
'
exit $?
