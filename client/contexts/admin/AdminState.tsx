'use client';

import type { ReactNode } from 'react';
import { ActivityProvider } from './ActivityProvider';
import { AdminAuthProvider, useAdminAuth } from './AdminAuthProvider';
import { EventDraftProvider } from './EventDraftProvider';
import { EventsProvider } from './EventsProvider';
import { ProfileProvider } from './ProfileProvider';
import { ToastProvider } from './ToastProvider';

// Session-scoped providers are re-created per user (and role): logging out or switching account
// starts them from their initial state, and their unmount cleanup drops in-flight responses
const AdminSessionProviders = ({ children }: { children: ReactNode }) => {
  const { user } = useAdminAuth();
  const sessionKey = user ? `${user.id}:${user.role}` : 'anonymous';

  return (
    <EventsProvider key={sessionKey}>
      <ActivityProvider>
        <ProfileProvider>
          <EventDraftProvider>{children}</EventDraftProvider>
        </ProfileProvider>
      </ActivityProvider>
    </EventsProvider>
  );
};

// Toasts wrap everything so auth and feature providers can report errors
export const AdminState = ({ children }: { children: ReactNode }) => {
  return (
    <div className="admin-app">
      <ToastProvider>
        <AdminAuthProvider>
          <AdminSessionProviders>{children}</AdminSessionProviders>
        </AdminAuthProvider>
      </ToastProvider>
    </div>
  );
};
