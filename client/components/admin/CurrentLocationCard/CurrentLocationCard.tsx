import { formatLocation } from '@/lib/admin/map';
import type { EventLocation } from '@/lib/admin/types';

interface CurrentLocationCardProps {
  // The point picked on the map, or null before the first tap
  location: EventLocation | null;
  onConfirm: (location: EventLocation) => void;
}

export const CurrentLocationCard = ({ location, onConfirm }: CurrentLocationCardProps) => {
  return (
    <div className="map-card">
      <div className="map-card__row">
        <span className="map-card__dot" />
        <div>
          <p className="map-card__small">
            {location ? 'Selected location' : 'Tap the map to place the event'}
          </p>
          <p className="map-card__big">{location ? formatLocation(location) : 'Cali, Colombia'}</p>
        </div>
      </div>
      <button
        type="button"
        className="map-card__button map-card__button--action"
        disabled={!location}
        onClick={() => location && onConfirm(location)}
      >
        Use this location
      </button>
    </div>
  );
};
