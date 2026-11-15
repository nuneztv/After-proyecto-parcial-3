'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthProvider';
import { canUseClientApp, getNextFromSearch } from '@/lib/redirect';

interface GuestRouteProps {
  children: ReactNode;
}

// The opposite of PrivateRoute, for /login and /register. It is also the only place that
// redirects after a successful login or sign-up: to the safe ?next= destination, or /home.
// While a stored session is being checked a spinner is shown instead of the form, so the
// form never flashes for someone who is already logged in
export const GuestRoute = ({ children }: GuestRouteProps) => {
  const { user, ready } = useAuth();
  const router = useRouter();
  const signedIn = canUseClientApp(user);

  useEffect(() => {
    if (ready && signedIn) router.replace(getNextFromSearch(window.location.search));
  }, [ready, signedIn, router]);

  if (!ready) {
    return (
      <section className="screen auth">
        <div className="spinner" aria-label="Loading" />
      </section>
    );
  }

  if (signedIn) return null;
  return <>{children}</>;
};
