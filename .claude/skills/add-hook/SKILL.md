---
name: add-hook
description: Adds a reusable custom hook to client/hooks (debounced search, geolocation, image upload, one-off subscription) following After conventions. Use for stateful logic that is not shared app state.
argument-hint: "<useName and purpose>"
---

# Add a hook

Argument: hook name and purpose (for example `useGeolocation for event distances`).

1. Read `.claude/rules/client-hooks.md` and `.claude/docs/client/hooks.md`.
2. For uploads, also read `.claude/docs/client/file-upload.md`.
3. Confirm it should be a hook and not a provider: shared across distant components → provider; local reusable logic → hook.
4. Create `client/hooks/<useName>.ts` with `'use client';`, a named export and an object return.
5. Add `renderHook` tests per `.claude/docs/client/testing.md`, including cleanup on unmount.
6. Run `npm run typecheck`, `npm run lint` and `npm test` in `client/`.
