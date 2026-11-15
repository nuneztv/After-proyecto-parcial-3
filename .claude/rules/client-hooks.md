---
paths:
  - "client/hooks/**/*.ts"
  - "client/hooks/**/*.tsx"
---

# Client hooks

- One hook per file in `client/hooks/`, named `useThing.ts`, exported by name. Always `'use client';`.
- A hook encapsulates reusable stateful logic that is **not** shared app state (that belongs in a provider): uploads, debounced search, geolocation, a one-off subscription.
- Return a plain object with state first and actions after: `{ imageUrl, uploading, error, selectFile, clear }`.
- Errors become user-facing strings with `getErrorMessage` from `@/lib/errors`, returned as `error: string | null`; the hook does not throw to the component.
- Clean up everything created in an effect: object URLs, timers, geolocation watchers, listeners, channels.
- Validate cheap constraints (type, size) before any network call.
- Constants (limits, allowed types) are module-level `const`s; export what components need.
- Hooks never render JSX.

Templates: `.claude/docs/client/hooks.md`, `.claude/docs/client/file-upload.md`.
