---
name: add-component
description: Adds one React component to client/components/<Name>/<Name>.tsx (or components/admin/<Name>/) following After conventions (named export, typed props, data-only callbacks, plain CSS, loading/empty/error states). Use for a single UI piece.
argument-hint: "<Name and purpose>"
---

# Add a component

Argument: component name and purpose (for example `PaymentList shows the current user's payments`).

1. Read `.claude/rules/client-components.md` and `.claude/docs/client/components.md`.
2. Check `client/components/` and `client/components/admin/` for an existing component to reuse or extend (`EmptyState`, `AuthForm`, `StatusBadge`, `EventCard`, `CapacityBar`...).
3. Create `client/components/<Name>/<Name>.tsx` (admin: `client/components/admin/<Name>/<Name>.tsx`). Get data from an existing `useX()` hook or accept props; callbacks receive data (`onSelect(id)`). Do not create a provider here (use `/add-context`). Add CSS classes to `app/globals.css` or `app/admin/admin.css`.
4. Add a Testing Library test following `.claude/docs/client/testing.md`.
5. Run `npm run typecheck`, `npm run lint` and `npm test` in `client/`.

If the component needs new shared state, new API calls or realtime, stop and use `/add-client-feature` instead.
