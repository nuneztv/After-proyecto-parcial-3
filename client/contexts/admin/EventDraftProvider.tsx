'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { NEW_DRAFT_KEY } from '@/lib/admin/drafts';
import type { DraftKey, EventDraft, EventDraftField, EventLocation } from '@/lib/admin/types';

type Drafts = Partial<Record<DraftKey, EventDraft>>;

interface EventDraftContextType {
  drafts: Drafts;
  updateDraft: (key: DraftKey, change: Partial<EventDraft>) => void;
  initDraft: (key: DraftKey, draft: EventDraft) => void;
  resetDraft: (key: DraftKey) => void;
}

const EMPTY_DRAFT: EventDraft = {
  title: '',
  description: '',
  venueName: '',
  date: '',
  time: '',
  endDate: '',
  endTime: '',
  capacity: '',
  location: null,
  imageUrl: null,
};

const EventDraftContext = createContext<EventDraftContextType | null>(null);

// Lives in the admin layout so every event form survives the round trip to /admin/map.
// One draft per form: editing an event never touches the "new event" draft.
// A draft belongs to one administrator: AdminState re-creates this provider per user, so logging
// out or switching account drops them all
export const EventDraftProvider = ({ children }: { children: ReactNode }) => {
  const [drafts, setDrafts] = useState<Drafts>({});

  const updateDraft = useCallback((key: DraftKey, change: Partial<EventDraft>) => {
    setDrafts((prev) => {
      // The create form starts empty; an edit draft only exists once its form loaded the event,
      // otherwise the form would later start from these partial values instead of the event
      const current = prev[key] ?? (key === NEW_DRAFT_KEY ? EMPTY_DRAFT : undefined);
      if (!current) return prev;
      return { ...prev, [key]: { ...current, ...change } };
    });
  }, []);

  // Only fills a missing draft: coming back from the map keeps what was already typed
  const initDraft = useCallback((key: DraftKey, draft: EventDraft) => {
    setDrafts((prev) => (prev[key] ? prev : { ...prev, [key]: draft }));
  }, []);

  const resetDraft = useCallback((key: DraftKey) => {
    setDrafts((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return (
    <EventDraftContext.Provider value={{ drafts, updateDraft, initDraft, resetDraft }}>
      {children}
    </EventDraftContext.Provider>
  );
};

interface UseEventDraftResult {
  // Always a full draft: the stored one, or empty values when there is none yet
  draft: EventDraft;
  // False until something was typed (create) or the event was loaded into it (edit)
  hasDraft: boolean;
  setField: (name: EventDraftField, value: string) => void;
  setLocation: (location: EventLocation) => void;
  setImageUrl: (imageUrl: string | null) => void;
  initDraft: (draft: EventDraft) => void;
  resetDraft: () => void;
}

export const useEventDraft = (key: DraftKey): UseEventDraftResult => {
  const ctx = useContext(EventDraftContext);
  if (!ctx) throw new Error('useEventDraft must be used within EventDraftProvider');
  const { drafts, updateDraft, initDraft, resetDraft } = ctx;

  const stored = drafts[key];

  const setField = useCallback(
    (name: EventDraftField, value: string) => {
      const change: Partial<EventDraft> = {};
      change[name] = value;
      updateDraft(key, change);
    },
    [key, updateDraft],
  );
  const setLocation = useCallback(
    (location: EventLocation) => updateDraft(key, { location }),
    [key, updateDraft],
  );
  const setImageUrl = useCallback(
    (imageUrl: string | null) => updateDraft(key, { imageUrl }),
    [key, updateDraft],
  );
  const init = useCallback((draft: EventDraft) => initDraft(key, draft), [key, initDraft]);
  const reset = useCallback(() => resetDraft(key), [key, resetDraft]);

  return useMemo(
    () => ({
      draft: stored ?? EMPTY_DRAFT,
      hasDraft: stored !== undefined,
      setField,
      setLocation,
      setImageUrl,
      initDraft: init,
      resetDraft: reset,
    }),
    [stored, setField, setLocation, setImageUrl, init, reset],
  );
};
