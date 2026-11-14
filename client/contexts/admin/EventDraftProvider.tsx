'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { EventDraft, EventDraftField, EventLocation } from '@/lib/admin/types';
import { useAdminAuth } from './AdminAuthProvider';

interface EventDraftContextType {
  draft: EventDraft;
  setField: (name: EventDraftField, value: string) => void;
  setLocation: (location: EventLocation) => void;
  setImageUrl: (imageUrl: string | null) => void;
  resetDraft: () => void;
}

const EMPTY_DRAFT: EventDraft = {
  title: '',
  description: '',
  venueName: '',
  date: '',
  time: '',
  endTime: '',
  capacity: '',
  location: null,
  imageUrl: null,
};

const EventDraftContext = createContext<EventDraftContextType | null>(null);

// Lives in the admin layout so the "new event" form survives the round trip to /admin/map
export const EventDraftProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAdminAuth();
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);

  // A draft belongs to one administrator: drop it on logout or account change
  useEffect(() => {
    setDraft(EMPTY_DRAFT);
  }, [user?.id]);

  const setField = useCallback((name: EventDraftField, value: string) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setLocation = useCallback((location: EventLocation) => {
    setDraft((prev) => ({ ...prev, location }));
  }, []);

  const setImageUrl = useCallback((imageUrl: string | null) => {
    setDraft((prev) => ({ ...prev, imageUrl }));
  }, []);

  const resetDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);

  return (
    <EventDraftContext.Provider value={{ draft, setField, setLocation, setImageUrl, resetDraft }}>
      {children}
    </EventDraftContext.Provider>
  );
};

export const useEventDraft = () => {
  const ctx = useContext(EventDraftContext);
  if (!ctx) throw new Error('useEventDraft must be used within EventDraftProvider');
  return ctx;
};
