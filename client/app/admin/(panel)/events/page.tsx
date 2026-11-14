'use client';

import { useState } from 'react';
import { useEvents } from '@/contexts/admin/EventsProvider';
import { PageHeader } from '@/components/admin/PageHeader/PageHeader';
import { PillTabs } from '@/components/admin/PillTabs/PillTabs';
import { EventCard } from '@/components/admin/EventCard/EventCard';
import { CreateEventButton } from '@/components/admin/CreateEventButton/CreateEventButton';
import { EmptyState } from '@/components/admin/EmptyState/EmptyState';
import type { EventStatus } from '@/lib/admin/types';

type EventsFilter = 'all' | EventStatus;

const filters: { value: EventsFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'closed', label: 'Closed' },
];

const isEventsFilter = (value: string): value is EventsFilter =>
  filters.some((option) => option.value === value);

const EventsPage = () => {
  const { events, eventsByStatus, loading, error } = useEvents();
  const [filter, setFilter] = useState<EventsFilter>('all');

  const visibleEvents = filter === 'all' ? events : eventsByStatus[filter];

  const handleSelect = (value: string) => {
    if (isEventsFilter(value)) setFilter(value);
  };

  return (
    <>
      <PageHeader title="Edit Event" backHref="/admin/overview" />
      <PillTabs options={filters} selected={filter} onSelect={handleSelect} />

      {loading && <EmptyState title="Loading events..." />}
      {error && <EmptyState title="Something went wrong" subtitle={error} />}
      {!loading && !error && visibleEvents.length === 0 && (
        <EmptyState title="No events here yet" />
      )}
      {visibleEvents.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}

      <CreateEventButton />
    </>
  );
};

export default EventsPage;
