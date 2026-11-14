'use client';

import type { ReactNode } from 'react';
import { ActivityProvider } from './ActivityProvider';
import { AdminAuthProvider } from './AdminAuthProvider';
import { EventDraftProvider } from './EventDraftProvider';
import { EventsProvider } from './EventsProvider';
import { ProfileProvider } from './ProfileProvider';
import { ToastProvider } from './ToastProvider';

// Toasts wrap everything so auth and feature providers can report errors
export const AdminState = ({ children }: { children: ReactNode }) => {
  return (
    <div className="admin-app">
      <ToastProvider>
        <AdminAuthProvider>
          <EventsProvider>
            <ActivityProvider>
              <ProfileProvider>
                <EventDraftProvider>{children}</EventDraftProvider>
              </ProfileProvider>
            </ActivityProvider>
          </EventsProvider>
        </AdminAuthProvider>
      </ToastProvider>
    </div>
  );
};
