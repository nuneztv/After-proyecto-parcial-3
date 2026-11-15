'use client';

import { useState } from 'react';
import { useEvents } from '@/contexts/admin/EventsProvider';
import { PageHeader } from '@/components/admin/PageHeader/PageHeader';
import { PillTabs } from '@/components/admin/PillTabs/PillTabs';
import { EventCard } from '@/components/admin/EventCard/EventCard';
import { CreateEventButton } from '@/components/admin/CreateEventButton/CreateEventButton';
import { EmptyState } from '@/components/admin/EmptyState/EmptyState';
import type { EventStatus } from '@/lib/admin/types';

const tabs: { value: EventStatus; label: string }[] = [
  { value: 'upcoming', label: 'Open' },
  { value: 'live', label: 'Set Live' },
  { value: 'closed', label: 'Closed' },
];

const isEventStatus = (value: string): value is EventStatus =>
  tabs.some((tab) => tab.value === value);

const LivePage = () => {
  const { eventsByStatus, loading, error } = useEvents();
  const [selected, setSelected] = useState<EventStatus>('live');

  const visibleEvents = eventsByStatus[selected];

  const handleSelect = (value: string) => {
    if (isEventStatus(value)) setSelected(value);
  };

  return (
    <>
      <PageHeader title="Live" backHref="/admin/overview" />
      <PillTabs options={tabs} selected={selected} onSelect={handleSelect} />

      {loading && <EmptyState title="Loading events..." />}
      {error && <EmptyState title="Something went wrong" subtitle={error} />}
      {!loading && !error && visibleEvents.length === 0 && (
        <EmptyState title="No events here yet" />
      )}
      {visibleEvents.map((event) => (
        <EventCard key={event.id} event={event} liveControl />
      ))}

      <CreateEventButton />
    </>
  );
};

export default LivePage;
