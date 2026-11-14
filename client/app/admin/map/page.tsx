'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { BackButton } from '@/components/admin/BackButton/BackButton';
import { CurrentLocationCard } from '@/components/admin/CurrentLocationCard/CurrentLocationCard';
import { SelectedEventCard } from '@/components/admin/SelectedEventCard/SelectedEventCard';
import { useEvents } from '@/contexts/admin/EventsProvider';
import { PrivateRoute } from '@/components/admin/PrivateRoute/PrivateRoute';
import { toMapPins } from '@/lib/admin/map';

const MapView = dynamic(() => import('@/components/MapView').then((mod) => mod.MapView), {
  ssr: false,
});

const MapPage = () => {
  const { mapEvents } = useEvents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pins = useMemo(() => toMapPins(mapEvents), [mapEvents]);
  const selectedEvent = mapEvents.find((event) => event.id === selectedId);

  return (
    <PrivateRoute>
      <div className="map">
        <MapView events={pins} selectedId={selectedId || undefined} onSelect={setSelectedId} />
        <div className="map__back">
          <BackButton href="/admin/events/new" />
        </div>
        <div className="map__cards">
          {selectedEvent ? (
            <SelectedEventCard event={selectedEvent} />
          ) : (
            <CurrentLocationCard backHref="/admin/events/new" />
          )}
        </div>
      </div>
    </PrivateRoute>
  );
};

export default MapPage;
