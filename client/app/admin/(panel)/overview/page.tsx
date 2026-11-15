'use client';

import Link from 'next/link';
import { useProfile } from '@/contexts/admin/ProfileProvider';
import { useEvents } from '@/contexts/admin/EventsProvider';
import { useActivity } from '@/contexts/admin/ActivityProvider';
import { Avatar } from '@/components/admin/Avatar/Avatar';
import { StatsGrid } from '@/components/admin/StatsGrid/StatsGrid';
import { LiveSummaryCard } from '@/components/admin/LiveSummaryCard/LiveSummaryCard';
import { ActivityList } from '@/components/admin/ActivityList/ActivityList';
import { CreateEventButton } from '@/components/admin/CreateEventButton/CreateEventButton';
import { EmptyState } from '@/components/admin/EmptyState/EmptyState';

const OverviewPage = () => {
  const { profile } = useProfile();
  const { liveEvents, loading, error } = useEvents();
  const {
    recentActivities,
    loading: activityLoading,
    error: activityError,
  } = useActivity();

  const firstName = profile ? profile.name.split(' ')[0] : '';

  return (
    <>
      <header className="overview-top">
        <div>
          <p className="eyebrow">NIGHT OPERATIONS</p>
          <h1 className="greeting">
            Good evening,
            <br />
            {firstName}
          </h1>
        </div>
        <div className="overview-top__right">
          <Avatar />
          <span className="shift-pill">
            <i /> ON SHIFT
          </span>
        </div>
      </header>

      <StatsGrid />

      <h2 className="section-title">
        Live Events
        <Link href="/admin/live">View controls</Link>
      </h2>

      {loading && <EmptyState title="Loading events..." />}
      {error && <EmptyState title="Something went wrong" subtitle={error} />}
      {!loading && !error && liveEvents.length === 0 && (
        <EmptyState title="No live events right now" />
      )}
      {liveEvents.map((event) => (
        <LiveSummaryCard key={event.id} event={event} />
      ))}

      <h2 className="section-title">Recent Activity</h2>
      {activityLoading && <EmptyState title="Loading activity..." />}
      {activityError && <EmptyState title="Something went wrong" subtitle={activityError} />}
      {!activityLoading && !activityError && recentActivities.length === 0 && (
        <EmptyState title="No activity yet" />
      )}
      {recentActivities.length > 0 && <ActivityList activities={recentActivities} showEvent />}

      <CreateEventButton />
    </>
  );
};

export default OverviewPage;
