'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/admin/BackButton/BackButton';
import { CurrentLocationCard } from '@/components/admin/CurrentLocationCard/CurrentLocationCard';
import { PrivateRoute } from '@/components/admin/PrivateRoute/PrivateRoute';
import { useEventDraft } from '@/contexts/admin/EventDraftProvider';
import { useEvents } from '@/contexts/admin/EventsProvider';
import { toMapPins } from '@/lib/admin/map';
import type { EventLocation } from '@/lib/admin/types';

const NEW_EVENT_PATH = '/admin/events/new';

// Leaflet needs the browser, so the picker is never rendered on the server
const LocationPicker = dynamic(
  () => import('@/components/admin/LocationPicker/LocationPicker').then((mod) => mod.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="splash">
        <div className="spinner" aria-label="Loading map" />
      </div>
    ),
  },
);

const MapPage = () => {
  const router = useRouter();
  const { mapEvents } = useEvents();
  const { draft, setLocation } = useEventDraft();
  // The tap is only a preview until "Use this location" writes it into the draft
  const [picked, setPicked] = useState<EventLocation | null>(draft.location);
  const pins = useMemo(() => toMapPins(mapEvents), [mapEvents]);

  const handleConfirm = (location: EventLocation) => {
    setLocation(location);
    router.push(NEW_EVENT_PATH);
  };

  return (
    <PrivateRoute>
      <div className="map">
        <LocationPicker events={pins} value={picked} onPick={setPicked} />
        <div className="map__back">
          <BackButton href={NEW_EVENT_PATH} />
        </div>
        <div className="map__cards">
          <CurrentLocationCard location={picked} onConfirm={handleConfirm} />
        </div>
      </div>
    </PrivateRoute>
  );
};

export default MapPage;
