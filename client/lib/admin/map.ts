import type { AfterEvent, EventLocation } from '@/lib/admin/types';

export interface MapPinData {
  id: string;
  latitude: number;
  longitude: number;
  mapLabel: string;
}

// Reference markers shown by the admin LocationPicker
export const toMapPins = (events: AfterEvent[]): MapPinData[] =>
  events.map((event) => ({
    id: event.id,
    latitude: event.latitude,
    longitude: event.longitude,
    mapLabel: event.name,
  }));

// Cali city center: where the location picker opens when nothing is selected yet
export const CALI_CENTER: EventLocation = { latitude: 3.4516, longitude: -76.532 };

const COORDINATE_DECIMALS = 5;

export const formatLocation = (location: EventLocation): string =>
  `${location.latitude.toFixed(COORDINATE_DECIMALS)}, ${location.longitude.toFixed(COORDINATE_DECIMALS)}`;
