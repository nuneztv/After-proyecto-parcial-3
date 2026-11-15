'use client';

import { useSettings } from '@/contexts/SettingsProvider';
import type { LocationStatus } from '@/contexts/SettingsProvider';

const STATUS_TEXT: Record<LocationStatus, string> = {
  off: 'Distances are measured from the center of Cali.',
  requesting: 'Waiting for your browser permission...',
  on: 'Distances are measured from your current location.',
  denied:
    'Location permission was denied. Distances are measured from the center of Cali. You can allow it again in your browser settings.',
  unavailable:
    'Your location is not available on this device right now. Distances are measured from the center of Cali.',
};

export const SettingsPanel = () => {
  const { locationStatus, enableLocation, disableLocation } = useSettings();
  const usingLocation = locationStatus === 'on' || locationStatus === 'requesting';

  return (
    <section className="info-card profile-panel" aria-label="Settings">
      <strong>Location</strong>
      <p className={locationStatus === 'denied' ? 'form-error' : 'muted'} role="status">
        {STATUS_TEXT[locationStatus]}
      </p>
      <button
        type="button"
        className="btn small"
        disabled={locationStatus === 'requesting'}
        onClick={usingLocation ? disableLocation : enableLocation}
      >
        {usingLocation ? 'Stop using my location' : 'Use my location'}
      </button>
      <p className="muted">
        Your position is only used in this browser to calculate distances. It is never sent to the
        After servers or saved.
      </p>
    </section>
  );
};
