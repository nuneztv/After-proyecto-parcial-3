# Hooks

Use a hook for reusable **local** logic. Shared app state belongs in a provider. File: `client/hooks/useThing.ts`, named export, `'use client';`.

Good candidates in After: `useDebouncedValue` (search box in `/home` and `/search`), `useGeolocation` (distance to events, `/map`, `/directions/[id]`), `useImageUpload` (admin new event), `useEventSubscription` (one-off realtime for a detail page).

## Template

```ts
'use client';

import { useEffect, useState } from 'react';

export const useDebouncedValue = <T,>(value: T, delayMs = 300): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
```

## Browser API hook

```ts
'use client';

import { useEffect, useState } from 'react';

interface Position { latitude: number; longitude: number }

export const useGeolocation = () => {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  useEffect(() => {
    if (!isSupported) return;

    const id = navigator.geolocation.watchPosition(
      (p) => setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => setError('Location permission denied'),
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [isSupported]);

  return { position, isSupported, error };
};
```

## Rules of thumb

- Return state first, actions after; the component never sees thrown errors, it reads `error`.
- Anything allocated in an effect is released in its cleanup (timers, watchers, object URLs, channels).
- Constants (limits, allowed types) at module level; export those components need.
- Complete dependency arrays.
- Window/DOM access only inside effects or handlers (SSR-safe).
- Hooks never render JSX.
