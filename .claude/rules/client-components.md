---
paths:
  - "client/components/**/*.tsx"
  - "client/app/**/*.tsx"
---

# Client components and pages

- One component per file, in its own folder: `components/<Name>/<Name>.tsx` (user app and shared) or `components/admin/<Name>/<Name>.tsx` (admin). Exported by name: `export const EventCard = () => {}`. Flat legacy files (`components/StatusBadge.tsx`) move to a folder when touched.
- `'use client';` only when the component uses state, effects, handlers or browser APIs.
- Components are presentational + composition. Data fetching and mutations live in providers or hooks (`useEvents()`, `useAuth()`). Components never import `axios` or `@/lib/axios`.
- Props are typed with an interface above the component. Callbacks are named `onX` and receive **data**, not DOM events: `onDelete(id)`, `onSelect(eventId)`, `onSubmit(values)`.
- Pages in `app/` are thin: compose `PrivateRoute`, providers and components. No filtering/derivation logic, no API calls, no auth logic in pages.
- Protected pages are wrapped in `PrivateRoute` (admin: `role="admin"`). Never check `localStorage` in a page.
- Render every state: loading (spinner/`EmptyState`), empty (`EmptyState`), error. Buttons are disabled and relabeled while a request is in flight (`Saving...`).
- Forms are controlled, validate before submitting, and show field errors with `role="alert"`. API errors are shown as toasts by the provider.
- Reuse `AuthForm`, `EmptyState`, `PrivateRoute`, `StatusBadge` instead of copying markup.
- Styling: plain CSS classes in `app/globals.css` / `app/admin/admin.css`. No Tailwind, no new inline `style={{}}`.
- Leaflet components load with `next/dynamic` + `{ ssr: false }`.
- Accessibility: labels or `aria-label` on inputs and icon buttons; `<button type="button">` unless submitting.
- Before using a Next.js API you are unsure about, check `client/node_modules/next/dist/docs/` (Next 16 differs from older versions).

Templates: `.claude/docs/client/components.md`.
