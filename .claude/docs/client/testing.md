# Client testing

Stack: Vitest + Testing Library + jsdom.

## Setup (done by `test-writer` if missing)

```bash
cd client && npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

`client/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
});
```

`client/test/setup.ts`: `import '@testing-library/jest-dom/vitest';`

Scripts: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`. Add `"types": ["vitest/globals"]` to `tsconfig.json`. Note: `tsconfig.json` has `"strict": false` today; turning it on is a separate, deliberate change (it will surface errors in existing pages).

`next/navigation` must be mocked in component tests: `vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, back }), useParams: () => ({ id: 'e1' }) }))`.

## Component test

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { EventList } from '@/components/admin/EventList/EventList';

test('EventList calls onDelete with the event id', async () => {
  const onDelete = vi.fn();
  render(<EventList events={[{ id: 'e1', name: 'Jazz & Wine' /* ... */ }]} deletingId={null} onDelete={onDelete} />);

  await userEvent.click(screen.getByRole('button', { name: /delete jazz & wine/i }));

  expect(onDelete).toHaveBeenCalledWith('e1');
});
```

## Provider test (real provider, mocked network)

Providers get axios through `useAxios()`, so wrap them with an `AxiosContext` that holds a mock instance (or `vi.mock('@/lib/axios')`), plus a `ToastProvider`:

```tsx
const api = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
vi.mock('@/lib/axios', () => ({ api }));

test('EventsProvider loads events on mount', async () => {
  api.get.mockResolvedValue({ data: [{ id: 'e1', title: 'Retro Night' }] });

  const { result } = renderHook(() => useEvents(), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.events).toHaveLength(1));
});

test('useEvents throws outside its provider', () => {
  expect(() => renderHook(() => useEvents())).toThrow('useEvents must be used within EventsProvider');
});
```

## Axios interceptor test

Use `axios-mock-adapter` or mock `axios.post`: first request → 401, refresh → 200 with a new token, retried request carries the new `Authorization` header; refresh failing → session cleared and `after:session-cleared` dispatched.

## Realtime

Mock `@/lib/supabase` so `channel().on().subscribe()` captures handlers; call a captured handler twice with the same payload and assert one item; unmount and assert `removeChannel` was called.

## Guidelines

- Query by role/label/text, never by class.
- Mock at the network boundary (`@/lib/axios`, `@/lib/supabase`), not inside components.
- Always test: loading/empty states, the main action, an error path (toast or `role="alert"`), and cleanup.
- Hand-written expected values; no snapshots of whole pages.
- If `tsc` complains about `PageProps`/`LayoutProps`, run `npx next typegen` first.
