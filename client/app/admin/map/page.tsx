'use client';

import { Suspense, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackButton } from '@/components/admin/BackButton/BackButton';
import { CurrentLocationCard } from '@/components/admin/CurrentLocationCard/CurrentLocationCard';
import { PrivateRoute } from '@/components/admin/PrivateRoute/PrivateRoute';
import { useEventDraft } from '@/contexts/admin/EventDraftProvider';
import { useEvents } from '@/contexts/admin/EventsProvider';
import { getDraftFormPath, parseDraftKey } from '@/lib/admin/drafts';
import { toMapPins } from '@/lib/admin/map';
import type { EventLocation } from '@/lib/admin/types';

const MapLoading = () => (
  <div className="splash">
    <div className="spinner" aria-label="Loading map" />
  </div>
);

// Leaflet needs the browser, so the picker is never rendered on the server
const LocationPicker = dynamic(
  () => import('@/components/admin/LocationPicker/LocationPicker').then((mod) => mod.LocationPicker),
  { ssr: false, loading: MapLoading },
);

// ?draft=new (default) or ?draft=edit:<event id>: the form whose location is being picked
const MapPicker = () => {
  const router = useRouter();
  const draftKey = parseDraftKey(useSearchParams().get('draft'));
  const returnPath = getDraftFormPath(draftKey);
  const { mapEvents } = useEvents();
  const { draft, setLocation } = useEventDraft(draftKey);
  // The tap is only a preview until "Use this location" writes it into the draft
  const [picked, setPicked] = useState<EventLocation | null>(draft.location);
  const pins = useMemo(() => toMapPins(mapEvents), [mapEvents]);

  const handleConfirm = (location: EventLocation) => {
    setLocation(location);
    router.push(returnPath);
  };

  return (
    <div className="map">
      <LocationPicker events={pins} value={picked} onPick={setPicked} />
      <div className="map__back">
        <BackButton href={returnPath} />
      </div>
      <div className="map__cards">
        <CurrentLocationCard location={picked} onConfirm={handleConfirm} />
      </div>
    </div>
  );
};

const MapPage = () => {
  return (
    <PrivateRoute>
      {/* Next 16: useSearchParams needs a Suspense boundary for the page to prerender */}
      <Suspense fallback={<MapLoading />}>
        <MapPicker />
      </Suspense>
    </PrivateRoute>
  );
};

export default MapPage;
