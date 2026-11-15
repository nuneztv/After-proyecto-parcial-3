import Link from 'next/link';
import type { Activity } from '@/lib/admin/types';
import { StatusBadge } from '../StatusBadge/StatusBadge';

interface ActivityListProps {
  activities: Activity[];
  bordered?: boolean;
  // Feeds that mix several events (overview) show which event each row belongs to
  showEvent?: boolean;
}

export const ActivityList = ({ activities, bordered = false, showEvent = false }: ActivityListProps) => {
  return (
    <ul className={bordered ? 'activity activity--bordered' : 'activity'}>
      {activities.map((activity) => (
        <li key={activity.id}>
          {showEvent && activity.event && (
            <span className="activity__event">
              <Link href={`/admin/live/${activity.event.id}`} className="activity__event-link">
                {activity.event.name}
              </Link>
              <StatusBadge status={activity.event.status} />
            </span>
          )}
          <span className="activity__time">{activity.time}</span> —{' '}
          {activity.message}
        </li>
      ))}
    </ul>
  );
};
