# Components and pages

## Folder map

```
client/
├── app/
│   ├── layout.tsx              # <Providers> + <PhoneShell>
│   ├── page.tsx                # splash → /home or /login
│   ├── login/ register/ forgot-password/
│   ├── home/ search/ map/ saved-events/ profile/
│   ├── events/[id]/ directions/[id]/ products/[id]/
│   └── admin/
│       ├── layout.tsx          # <AdminState> (admin providers) + admin.css
│       ├── login/ register/ profile/ map/ events/new/
│       └── (panel)/            # pages with the admin BottomNav: overview, events, live, live/[id]
├── components/
│   ├── <Name>/<Name>.tsx       # user app + shared components (target layout)
│   └── admin/<Name>/<Name>.tsx # admin components (already in this layout)
├── contexts/  hooks/  lib/  types/
└── app/globals.css, app/admin/admin.css   # plain CSS, BEM-ish classes for admin
```

Legacy: user components are flat files (`components/StatusBadge.tsx`, `Guard.tsx`, `MapView.tsx`...). New components go in their own folder; move a flat one to `components/<Name>/<Name>.tsx` when you touch it and update its imports.

## Component template

```tsx
'use client';

import type { AfterEvent } from '@/lib/admin/types';
import { EventCard } from '../EventCard/EventCard';
import { EmptyState } from '../EmptyState/EmptyState';

interface EventListProps {
  events: AfterEvent[];
  deletingId: string | null;
  onDelete: (id: string) => void;
}

export const EventList = ({ events, deletingId, onDelete }: EventListProps) => {
  if (events.length === 0) {
    return <EmptyState title="No events here yet" />;
  }

  return (
    <div className="event-list">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          isDeleting={deletingId === event.id}
          onDelete={() => onDelete(event.id)}
        />
      ))}
    </div>
  );
};
```

Callbacks carry **data**, not DOM events: `onDelete(id)`, `onSelect(eventId)`, `onSubmit(values)`. The component that owns the `<form>` calls `event.preventDefault()` and passes clean values up.

## Form template (controlled, validated, loading flag, toast)

```tsx
'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '@/contexts/AuthProvider';

export const LoginForm = () => {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldError('Enter a valid email');
      return;
    }

    setFieldError(null);
    // The provider shows the error toast and redirects on success
    await login(email.trim(), password);
  };

  return (
    <form className="auth-card" onSubmit={handleSubmit} noValidate>
      {fieldError && <p role="alert" className="form-error">{fieldError}</p>}
      <label className="field">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email address"
          aria-label="Email address"
        />
      </label>
      {/* password field */}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? 'Entering...' : 'Log In'}
      </button>
    </form>
  );
};
```

## Reusable building blocks (rubric)

| Component | Use |
|-----------|-----|
| `AuthForm` | Shell for login/register in **both** apps (logo, card, submit with `loading`, footer link). Inputs are children; `onSubmit` receives no event |
| `EmptyState` | Empty, loading and error placeholders (`title`, `subtitle`, optional action) |
| `PrivateRoute` | Wraps protected pages: spinner until `ready`, redirect to `/login` (or `/admin/login` when `role="admin"`) if there is no session or the role does not match. Today this is `components/Guard.tsx` |
| `Toast` / `ToastViewport` | Rendered by `ToastProvider` |
| `Spinner` | Loading indicator (`.spinner` class) |

## Page template (thin)

```tsx
'use client';

import { PrivateRoute } from '@/components/PrivateRoute/PrivateRoute';
import { SavedEventsList } from '@/components/SavedEventsList/SavedEventsList';

export default function SavedEventsPage() {
  return (
    <PrivateRoute>
      <AppScreen>
        <h1 className="page-title">Saved Events</h1>
        <SavedEventsList />
      </AppScreen>
    </PrivateRoute>
  );
}
```

Pages compose providers and components. No filtering, no `axios` calls, no business rules in pages (today `home/page.tsx` filters sections and `profile/page.tsx` filters payments: move those to providers).

Dynamic params: this codebase uses `useParams<{ id: string }>()` in client pages; keep it.

## Guidelines

- `'use client'` only when you need state, effects, handlers or browser APIs.
- Leaflet (`MapView`) is browser-only: load it with `next/dynamic` and `{ ssr: false }`.
- Render loading, empty and error states explicitly (`EmptyState`). Disable buttons while in flight and change the label (`Creating...`, `Deleting...`, `Saving...`).
- Styling: plain CSS classes in `app/globals.css` (user) and `app/admin/admin.css` (admin). No inline styles for new code; no Tailwind.
- Images: existing code mixes `<img>` and `next/image`. Supabase Storage URLs with `next/image` need `images.remotePatterns` in `next.config.js`.
- Next.js 16 may differ from older versions: check `client/node_modules/next/dist/docs/` before using a Next API you are unsure about.
