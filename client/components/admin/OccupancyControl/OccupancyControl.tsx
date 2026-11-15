const DELTAS = [-5, -1, 1, 5] as const;

interface OccupancyControlProps {
  occupied: number;
  capacity: number;
  // An occupancy change is in flight
  updating: boolean;
  onChange: (delta: number) => void;
}

const toLabel = (delta: number): string => {
  const people = Math.abs(delta) === 1 ? 'person' : 'people';
  return delta > 0 ? `Check in ${delta} ${people}` : `Check out ${-delta} ${people}`;
};

export const OccupancyControl = ({ occupied, capacity, updating, onChange }: OccupancyControlProps) => {
  return (
    <div className="occupancy-control">
      <p className="occupancy-control__label" aria-live="polite">
        {updating ? 'Updating...' : 'Adjust occupancy'}
      </p>
      <div className="occupancy-control__buttons">
        {DELTAS.map((delta) => {
          const next = occupied + delta;
          const outOfRange = next < 0 || next > capacity;

          return (
            <button
              key={delta}
              type="button"
              className={
                delta > 0
                  ? 'occupancy-control__button occupancy-control__button--in'
                  : 'occupancy-control__button'
              }
              aria-label={toLabel(delta)}
              disabled={updating || outOfRange}
              onClick={() => onChange(delta)}
            >
              {delta > 0 ? `+${delta}` : `−${-delta}`}
            </button>
          );
        })}
      </div>
    </div>
  );
};
