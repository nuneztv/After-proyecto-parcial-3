'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/contexts/admin/AdminAuthProvider';

// Admin pages only render for a logged-in administrator; everyone else goes to /admin/login
export const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { user, ready } = useAdminAuth();
  const router = useRouter();
  const allowed = user?.role === 'admin';

  useEffect(() => {
    if (ready && !allowed) router.replace('/admin/login');
  }, [ready, allowed, router]);

  if (!allowed) {
    return (
      <div className="splash">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  return <>{children}</>;
};
