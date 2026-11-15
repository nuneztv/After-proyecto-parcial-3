---
name: add-server-feature
description: Adds a server-only After feature with the layered architecture (router, controller, service, repository, types) under server/src/features, backed by Supabase. Use for new API resources when no client work is needed.
argument-hint: "<resource, e.g. event activity>"
disable-model-invocation: true
---

# Add a server feature

Argument: the feature/resource (for example `event activity feed`).

Steps:

1. Run `feature-planner` for the resource (API contract, table, types, test cases).
2. Run `server-writer` with the plan.
3. Run `test-writer` limited to the server.
4. Run `code-reviewer`; loop on `CHANGES REQUIRED` (max 2 rounds).

Load on demand, only what the plan needs:

- Layer map and file template: `.claude/docs/server/layers.md`
- Router and controller (`asyncHandler`, validation, status codes): `.claude/docs/server/router-controller.md`
- Service (business rules, ownership, broadcasts): `.claude/docs/server/service.md`
- Repository (SQL, `json_build_object`, CTE): `.claude/docs/server/repository.md`
- New table: `.claude/docs/server/db-init.md` (or run `/add-db-table`)
- Errors: `.claude/docs/server/errors-boom.md`
- Mounting the router and env vars: `.claude/docs/server/env-config.md`

Done when `npm run typecheck`, `npm run lint` and `npm test` pass in `server/` and the reviewer approves.
