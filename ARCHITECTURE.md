# Architecture of the After Claude harness

How the pieces of the Claude Code harness in this repo fit together. It is adapted from the course's `fullstack-harness` to the After project (Next.js user + admin apps, Express 4 API, Supabase). For the rules Claude reads on every task see `CLAUDE.md`; for the product and data model see `.claude/docs/project/domain.md`.

## The idea in one paragraph

The harness turns "build me a feature" into a fixed loop: **plan → server → client → tests → review → verify**. Each step is a specialised **agent** with limited tools. A **skill** (or the headless script) is the orchestrator that runs the agents in order. **Rules** and **docs** tell the agents how After's code must look. **Hooks** and **permissions** enforce the parts that must never depend on an agent's good behaviour (secrets, lint, checks).

```
                         you
                          │  /add-feature "saved events in Supabase"     bash .claude/scripts/harness.sh "..."
                          ▼                                                     │ (headless)
              ┌───────────────────────┐                                         │
              │   SKILL (orchestrator)│◄────────────────────────────────────────┘ same flow
              │   .claude/skills/     │
              └───────────┬───────────┘
        one at a time, in order; each agent has no memory of the others
                          │
   ┌──────────┬───────────┼────────────┬──────────────┬──────────────┐
   ▼          ▼           ▼            ▼              ▼
 planner → server-writer → client-writer → test-writer → code-reviewer
 (opus)     (sonnet)       (sonnet)        (sonnet)       (sonnet)
 read-only  server/ only   client/ only    tests only     read-only
   │            │              │              │              │
   └────────────┴──────┬───────┴──────────────┴──────────────┘
                       │ all of them read
         ┌─────────────┼───────────────────────┬──────────────────────────┐
         ▼             ▼                       ▼                          ▼
     CLAUDE.md    .claude/rules/          .claude/docs/          .claude/docs/project/domain.md
     (always)     (by file path)          (on demand)            (target tables, API, realtime, gaps)
                       │
        enforced around every tool call by
                       ▼
        .claude/settings.json ──► permissions (allow / deny)
                              └─► hooks (PreToolUse, PostToolUse, Stop)
```

## Folder map

```
After-app/
├── CLAUDE.md                  entry point: project shape, commands, conventions, definition of done
├── ARCHITECTURE.md            this file
├── client/  server/           the app
└── .claude/
    ├── settings.json          permissions + hook registration
    ├── agents/                feature-planner, server-writer, client-writer, test-writer, code-reviewer
    ├── skills/                12 slash commands (orchestrators + builders, incl. /connect-supabase)
    ├── rules/                 9 path-scoped convention files, loaded automatically
    ├── docs/
    │   ├── project/domain.md  After's apps, target Supabase schema, API + realtime contract, rubric gaps
    │   ├── server/            layers, router-controller, service, repository, db-init, auth, realtime, uploads, env, testing
    │   ├── client/            components, contexts (providers), hooks, lib-axios-auth, realtime, uploads, testing
    │   └── workflow/          api-contract-template.md, review-checklist.md (mirrors the rubric)
    └── scripts/
        ├── harness.sh         headless version of the whole flow
        └── hooks/             block-env.sh, post-edit.sh, stop.sh (node-based, Windows friendly)
```

## What was adapted from the course harness

| Course harness assumes | After reality | Where it is reflected |
|------------------------|---------------|-----------------------|
| Express 5 (async errors forwarded) | Express 4 | `asyncHandler` mandatory in rules, docs and checklist |
| `src/config/config.ts` | `src/config.ts` (single file) | `server-db.md`, `env-config.md` |
| `errorMiddleware.ts` | `errorsMiddleware.ts` + `asyncHandler` | `errors-boom.md` |
| `<feature>.router.ts` | `features/<plural>/<singular>.router.ts`, `export const router` | `server-layers.md`, `layers.md` |
| `client/context/XContext.tsx` | `client/contexts/XProvider.tsx` (+ `contexts/admin/`) | `client-contexts.md`, `contexts.md` |
| Tailwind | plain CSS (`globals.css`, `admin.css`) | `client-components.md` |
| `lib/types.ts` | `types/models.ts` + `lib/admin/types.ts` | `client-lib.md` |
| `api` imported directly | `AxiosProvider` / `useAxios()` wrapping `lib/axios.ts` | `lib-axios-auth.md` |
| Generic auth | Supabase Auth with refresh token, roles `client` / `admin`, `PrivateRoute` | `auth-middleware.md`, `lib-axios-auth.md`, `/add-auth` |
| Socket.io or Supabase | Supabase Broadcast only (rubric) | `realtime-*.md`, `/add-realtime` |
| python3 in hooks | node (python3 on this Windows machine is the Store alias) | `scripts/` |
| New project | existing mock data to migrate | `domain.md` gaps, `/connect-supabase` |

## The layers and what each one is for

| Layer | Loaded when | Purpose | Can the agent ignore it? |
|-------|-------------|---------|--------------------------|
| `CLAUDE.md` | every session | Project shape, commands, conventions, definition of done | Yes (guidance) |
| `rules/` | when a file matching its `paths:` is edited | Short, strict conventions for that kind of file | Yes (guidance, loaded exactly when relevant) |
| `docs/` | when a skill, agent or rule points to a page | Long templates, After-specific examples | Yes |
| `agents/` | when the orchestrator launches them | Role, process, tool limits, report format | Tool limits: no. Process: yes |
| `settings.json` + hooks | on every tool call | Hard guarantees: secrets, lint, checks | **No** |

## Agents

| Agent | Model | Tools | Writes to | Ends with |
|-------|-------|-------|-----------|-----------|
| `feature-planner` | opus | Read, Grep, Glob | nothing | Plan: API contract, tables, files, realtime, test cases, assumptions |
| `server-writer` | sonnet | + Edit, Write, Bash | `server/` (no tests) | Files, routes, env vars, events, error cases |
| `client-writer` | sonnet | + Edit, Write, Bash | `client/` (no tests) | Files, provider values, props, subscriptions, server mismatches |
| `test-writer` | sonnet | + Edit, Write, Bash | test files and config | Tests, pass/fail, real bugs found |
| `code-reviewer` | sonnet | Read, Grep, Glob, Bash | nothing | Blockers, suggestions, checks, `VERDICT: APPROVED / CHANGES REQUIRED` |

## Skills

**Orchestrators** (`disable-model-invocation: true`, only run when you type them): `/add-feature`, `/add-server-feature`, `/add-client-feature`, `/connect-supabase`, `/add-auth`, `/add-realtime`, `/add-file-upload`.

**Builders** (one narrow job, no agents): `/add-component`, `/add-context`, `/add-hook`, `/add-db-table`.

**Checks:** `/verify` runs typecheck, lint and tests per workspace and reports a table; it never edits code.

Recommended order to close the rubric gaps: `/add-auth` → `/connect-supabase events` → `/connect-supabase products` → `/connect-supabase payments` → `/connect-supabase saved-events` → `/add-realtime` (occupancy + activity) → `/add-file-upload` (event images).

## Hooks and permissions

| Event | Script | What it does |
|-------|--------|--------------|
| `PreToolUse` (Bash, Read, Edit, Write, Grep, Glob) | `block-env.sh` | Blocks any call whose command or path mentions a real `.env` (`.env.example` allowed), including Windows paths |
| `PostToolUse` (Edit, Write) | `post-edit.sh` | Runs ESLint on only the edited file, once the workspace has an ESLint config |
| `Stop` | `stop.sh` | Typecheck, lint and tests on workspaces with uncommitted changes; exit 2 keeps Claude working; loop guard on the second stop; missing scripts/config are warnings |

Hooks are invoked as `bash "<script>"`, so they work on Windows (Git Bash) without `chmod +x`.

## Headless flow (`harness.sh`)

Same loop as `/add-feature`, driven by one `claude -p` per step: plan → implement → tests → (fix bugs) → verify + review loop (up to `MAX_ROUNDS`, default 3) → final verify. Exit 0 only if the reviewer approved **and** checks pass. Run `claude` in the folder once to accept the trust dialog first.

## Known limits

- Consistency is by convention: the same rules appear in `rules/`, `docs/` and `review-checklist.md`.
- Until the scripts in "Known gaps" exist (`typecheck`, `lint` config, `test`), the Stop hook and `/verify` can only warn about them.
- The harness never touches `.env` files: Supabase credentials must be filled in by a human.
