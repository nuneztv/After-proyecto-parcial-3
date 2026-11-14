---
name: add-feature
description: Orchestrates a complete After feature (plan, server, client, tests, review) by running the project agents in order. Use when the user asks for a new feature that touches both client and server.
argument-hint: "<feature description>"
disable-model-invocation: true
---

# Add a fullstack feature

Argument: the feature description (for example `saved events stored in Supabase` or `admin live occupancy control with realtime`).

You are the orchestrator: agents do not call each other. Launch them **one at a time, in this order**, because each depends on the previous result. Pass each agent everything it needs; it has no memory of earlier steps.

1. **`feature-planner`**: give it the description. Keep the plan. If the plan shows important assumptions (user vs admin, realtime, a migration of an existing table, deleting mock data) or the feature already exists, tell the user before continuing.
2. **`server-writer`**: give it the full plan. Keep its report (routes, env vars, events, error cases).
3. **`client-writer`**: give it the plan **and** the server report.
4. **`test-writer`**: give it the plan's test cases and both reports.
5. **`code-reviewer`**: ask it to review all changes against the plan.

Then:

- If `test-writer` reports a real bug, send it to the owner agent (`server-writer` or `client-writer`) and re-run `test-writer` (maximum 2 rounds).
- If the reviewer answers `CHANGES REQUIRED`, send each blocker to the agent that owns it and repeat step 5.
- Finish only when the reviewer says `APPROVED` and typecheck, lint and tests pass in every touched workspace (use `/verify`).

Optional deep dives, load only if the plan needs them: `/connect-supabase`, `/add-db-table`, `/add-realtime`, `/add-file-upload`, `/add-auth`.

Finish by summarizing for the user (in Spanish if they wrote in Spanish): what was added (routes, tables, providers, components), env vars they must set in `.env` / `.env.local`, SQL they must run in Supabase (if any), the number of tests, and the reviewer verdict.
