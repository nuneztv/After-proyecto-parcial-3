import { StatusBadge } from '@/components/StatusBadge/StatusBadge';
import { IconPin } from '@/components/Icons/Icons';
import type { EventView } from '@/types/models';

interface EventCardProps {
  event: EventView;
  onOpen: (eventId: string) => void;
}

// Event with cover, status, venue, distance and occupancy (Home lists and search results)
export const EventCard = ({ event, onOpen }: EventCardProps) => {
  return (
    <article className="event-card">
      <button className="cover" onClick={() => onOpen(event.id)}>
        <img src={event.imageUrl} alt={event.title} />
        <StatusBadge status={event.status} />
      </button>
      <div className="card-body">
        <h3>{event.title}</h3>
        <p className="muted">{event.venueName}</p>
        <div className="meta-row">
          <span className="meta-pin">
            <IconPin /> {event.distanceKm} km
          </span>
          <span>
            {event.occupied}/{event.capacity}
          </span>
        </div>
      </div>
    </article>
  );
};
