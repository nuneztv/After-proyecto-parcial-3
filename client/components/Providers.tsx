"use client";

import { ReactNode } from "react";
import { AxiosProvider } from "@/contexts/AxiosProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import { DataProvider } from "@/contexts/DataProvider";
import { EventsProvider } from "@/contexts/EventsProvider";

// Session-scoped providers are re-created per user, so nothing from one account (events,
// filters, saved ids) survives a logout/login as another user
const SessionProviders = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  return (
    <EventsProvider key={user?.id ?? "anonymous"}>
      <DataProvider>{children}</DataProvider>
    </EventsProvider>
  );
};

export const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <AxiosProvider>
      <AuthProvider>
        <SessionProviders>{children}</SessionProviders>
      </AuthProvider>
    </AxiosProvider>
  );
};
