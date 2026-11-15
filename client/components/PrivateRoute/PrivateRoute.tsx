'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthProvider';
import { LOGIN_PATH, buildLoginPath, canUseClientApp } from '@/lib/redirect';

interface PrivateRouteProps {
  children: ReactNode;
}

// Renders the page only for a signed-in "client" account. `ready` turns true once AuthProvider
// has restored the stored session and confirmed it with GET /api/auth/me (refreshing it if
// needed), so a reload never bounces a valid session to /login. AuthProvider never keeps a
// non-client session; the role check here is a second line of defense
export const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { user, ready, signedOut } = useAuth();
  const router = useRouter();
  const allowed = canUseClientApp(user);

  useEffect(() => {
    if (!ready || allowed) return;
    // After a voluntary logout the page being left must not become a ?next= destination,
    // otherwise the next login would send the user back to it instead of /home
    if (signedOut) {
      router.replace(LOGIN_PATH);
      return;
    }
    // Read in the effect (browser only): remembers where the user wanted to go
    const { pathname, search } = window.location;
    router.replace(buildLoginPath(`${pathname}${search}`));
  }, [ready, allowed, signedOut, router]);

  if (!ready) {
    return (
      <section className="screen auth">
        <div className="spinner" aria-label="Loading" />
      </section>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
};
