"use client";

import { ReactNode } from "react";
import { AxiosProvider } from "@/contexts/AxiosProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import { EventsProvider } from "@/contexts/EventsProvider";
import { NotificationsProvider } from "@/contexts/NotificationsProvider";
import { PaymentsProvider } from "@/contexts/PaymentsProvider";
import { ProductsProvider } from "@/contexts/ProductsProvider";
import { SavedEventsProvider } from "@/contexts/SavedEventsProvider";
import { SettingsProvider } from "@/contexts/SettingsProvider";
import { ToastProvider } from "@/contexts/ToastProvider";

// Session-scoped providers are re-created per user, so nothing from one account (events,
// filters, favorites, payments) survives a logout/login as another user
const SessionProviders = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  return (
    <EventsProvider key={user?.id ?? "anonymous"}>
      <SavedEventsProvider>
        <NotificationsProvider>
          <ProductsProvider>
            <PaymentsProvider>{children}</PaymentsProvider>
          </ProductsProvider>
        </NotificationsProvider>
      </SavedEventsProvider>
    </EventsProvider>
  );
};

export const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AxiosProvider>
          <AuthProvider>
            <SessionProviders>{children}</SessionProviders>
          </AuthProvider>
        </AxiosProvider>
      </SettingsProvider>
    </ToastProvider>
  );
};
