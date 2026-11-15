'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_ORIGIN } from '@/lib/eventMappers';
import type { Coordinates } from '@/lib/eventMappers';
import { getLocationPreference, setLocationPreference } from '@/lib/storage';

// off: not asked (or turned off). requesting: waiting for the browser. on: using the position.
// denied: the user refused the permission. unavailable: no geolocation or it failed
export type LocationStatus = 'off' | 'requesting' | 'on' | 'denied' | 'unavailable';

interface SettingsContextType {
  // Where event distances are measured from
  origin: Coordinates;
  locationStatus: LocationStatus;
  enableLocation: () => void;
  disableLocation: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const LOCATION_TIMEOUT_MS = 10000;

// Device preferences (not tied to the account). Only the on/off choice is stored: the position
// itself stays in memory and is asked again on each visit
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [origin, setOrigin] = useState<Coordinates>(DEFAULT_ORIGIN);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('off');

  const enableLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus('on');
        setLocationPreference(true);
      },
      (error) => {
        // Back to central Cali either way; a refusal also forgets the preference
        setOrigin(DEFAULT_ORIGIN);
        const denied = error.code === error.PERMISSION_DENIED;
        setLocationStatus(denied ? 'denied' : 'unavailable');
        if (denied) setLocationPreference(false);
      },
      { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const disableLocation = useCallback(() => {
    setOrigin(DEFAULT_ORIGIN);
    setLocationStatus('off');
    setLocationPreference(false);
  }, []);

  // The choice made on a previous visit: the browser remembers a granted permission, so this
  // does not prompt again
  useEffect(() => {
    // The browser permission is the external system this effect syncs with
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (getLocationPreference()) enableLocation();
  }, [enableLocation]);

  const value = useMemo(
    () => ({ origin, locationStatus, enableLocation, disableLocation }),
    [origin, locationStatus, enableLocation, disableLocation],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
