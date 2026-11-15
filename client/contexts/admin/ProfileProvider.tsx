'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { AdminUser, Profile } from '@/lib/admin/types';
import { useAdminAuth } from './AdminAuthProvider';

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

const toInitials = (fullName: string): string =>
  fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

const toProfile = (user: AdminUser): Profile => ({
  id: user.id,
  name: user.fullName,
  username: `@${user.username}`,
  email: user.email,
  role: user.role === 'admin' ? 'Administrator' : 'Client',
  initials: toInitials(user.fullName),
  avatar: user.avatarUrl,
});

// The profile is the logged-in administrator (from AdminAuthProvider), not hard-coded data
export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user, ready } = useAdminAuth();
  const profile = useMemo(() => (user ? toProfile(user) : null), [user]);

  return (
    <ProfileContext.Provider value={{ profile, loading: !ready, error: null }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
};
