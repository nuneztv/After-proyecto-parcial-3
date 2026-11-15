'use client';

import { useCallback } from 'react';
import { useActivity } from '@/contexts/admin/ActivityProvider';
import { useEvents } from '@/contexts/admin/EventsProvider';

interface UseOccupancyResult {
  updating: boolean;
  // Resolves to true when the change was saved; failures are already toasted by EventsProvider
  changeOccupancy: (id: string, delta: number) => Promise<boolean>;
}

// One occupancy change updates two providers: the event (EventsProvider) and its feed (ActivityProvider)
export const useOccupancy = (): UseOccupancyResult => {
  const { updateOccupancy, updatingOccupancy } = useEvents();
  const { addActivity } = useActivity();

  const changeOccupancy = useCallback(
    async (id: string, delta: number) => {
      const activity = await updateOccupancy(id, delta);
      if (!activity) return false;

      addActivity(activity);
      return true;
    },
    [updateOccupancy, addActivity],
  );

  return { updating: updatingOccupancy, changeOccupancy };
};
