---
name: add-client-feature
description: Adds an After client feature (provider, components in their own folders, hooks, page wiring) for the user app or the admin app, consuming an existing API. Use when the server endpoints already exist.
argument-hint: "<feature, e.g. admin events list with delete>"
disable-model-invocation: true
---

# Add a client feature

Argument: the feature (for example `profile page shows my payments from the API`).

Steps:

1. Run `feature-planner`; it must confirm the endpoints it will consume already exist (read `server/src/features/**/*.router.ts` and `server/src/app.ts`). If they do not, stop and suggest `/add-feature`.
2. Run `client-writer` with the plan.
3. Run `test-writer` limited to the client.
4. Run `code-reviewer`; loop on `CHANGES REQUIRED` (max 2 rounds).

Load on demand, only what the plan needs:

- State and API calls: `.claude/docs/client/contexts.md`
- UI building blocks: `.claude/docs/client/components.md`
- Reusable logic: `.claude/docs/client/hooks.md`
- API client, config, errors, session, `PrivateRoute`: `.claude/docs/client/lib-axios-auth.md`
- Realtime: `.claude/docs/client/realtime-subscription.md`
- Uploads: `.claude/docs/client/file-upload.md`

Done when `npm run typecheck`, `npm run lint`, `npm test` pass in `client/` and the reviewer approves.
