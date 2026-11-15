import type { ApiEvent, EventFilters, EventSection, EventView } from '@/types/models';

// After is a Cali app: dates are shown in Bogota time whatever the device's time zone
export const EVENT_TIME_ZONE = 'America/Bogota';
// Bogota has no daylight saving time: local midnight is always 05:00 UTC
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Distances are measured from the city center (the map's default center) until the app asks
// for the user's location
export const DEFAULT_ORIGIN = { latitude: 3.4516, longitude: -76.532 };
export const FALLBACK_EVENT_IMAGE = '/images/events/disco-ball.png';

// Categories GET /api/events accepts (server EVENT_CATEGORIES); any other one answers 400
export const SERVER_CATEGORIES = ['music', 'party', 'rooftop', 'bar', 'concert'];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

// "Sat, Mar 17, 2026"
export const formatEventDate = (iso: string): string => dateFormat.format(new Date(iso));

// "6:00 pm - 2:00 am". Newer ICU versions put a narrow no-break space before AM/PM
const formatTime = (iso: string): string =>
  timeFormat.format(new Date(iso)).replace(/\s/g, ' ').toLowerCase();

export const formatEventTime = (startsAt: string, endsAt: string | null): string =>
  endsAt ? `${formatTime(startsAt)} - ${formatTime(endsAt)}` : formatTime(startsAt);

// Great-circle distance (haversine), rounded to one decimal
export const distanceKm = (from: Coordinates, to: Coordinates): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(km * 10) / 10;
};

// Start of the Bogota day that contains `time`, as a UTC timestamp
const bogotaMidnight = (time: number): number =>
  Math.floor((time - BOGOTA_OFFSET_MS) / DAY_MS) * DAY_MS + BOGOTA_OFFSET_MS;

// Events created from the admin app have no section: live ones are "happening now" and the
// ones that start today are tonight's picks. The rest only show up in search and on the map
export const deriveSection = (event: ApiEvent, now: number): EventSection | null => {
  if (event.section) return event.section;
  if (event.status === 'live') return 'happening';
  const start = Date.parse(event.startsAt);
  return bogotaMidnight(start) === bogotaMidnight(now) ? 'tonight' : null;
};

export const toEventView = (
  event: ApiEvent,
  origin: Coordinates = DEFAULT_ORIGIN,
  now: number = Date.now(),
): EventView => ({
  id: event.id,
  title: event.title,
  description: event.description,
  venueName: event.venueName,
  address: event.address,
  imageUrl: event.imageUrl || FALLBACK_EVENT_IMAGE,
  categories: event.categories,
  status: event.status,
  startsAt: event.startsAt,
  endsAt: event.endsAt,
  displayDate: formatEventDate(event.startsAt),
  displayTime: formatEventTime(event.startsAt, event.endsAt),
  latitude: event.latitude,
  longitude: event.longitude,
  distanceKm: distanceKm(origin, event),
  capacity: event.capacity,
  occupied: event.occupied,
  rating: event.rating,
  section: deriveSection(event, now),
  mapLabel: event.mapLabel || event.title,
});

// Straight-line walking estimate at ~5 km/h, at least 1 minute
export const walkingMinutes = (km: number): number => Math.max(1, Math.round((km / 5) * 60));

// [start, end) windows in Bogota time for the "Time" chips of the search screen
const timeWindow = (time: string, now: number): [number, number] | null => {
  const today = bogotaMidnight(now);

  if (time === 'today') return [today, today + DAY_MS];
  if (time === 'tonight') return [today + 18 * HOUR_MS, today + DAY_MS + 6 * HOUR_MS];
  if (time === 'tomorrow') return [today + DAY_MS, today + 2 * DAY_MS];
  if (time === 'weekend') {
    // getUTCDay of a Bogota midnight shifted back to 00:00 UTC gives the Bogota weekday
    const weekday = new Date(today - BOGOTA_OFFSET_MS).getUTCDay();
    const daysToSaturday = (6 - weekday + 7) % 7;
    // Already Sunday: the weekend is today. Otherwise it starts on Friday night
    if (weekday === 0) return [today, today + DAY_MS];
    const saturday = today + daysToSaturday * DAY_MS;
    return [saturday - 6 * HOUR_MS, saturday + 2 * DAY_MS];
  }
  return null;
};

// An event matches when it starts inside the window, or when it is in progress right now and
// "now" is inside the window. Plain overlap is not used on purpose: tonight's party that ends
// at 2 am must not show up under "Tomorrow"
export const matchesTime = (event: EventView, time: string, now: number = Date.now()): boolean => {
  const window = timeWindow(time, now);
  if (!window) return true;

  const [from, to] = window;
  const start = Date.parse(event.startsAt);
  const end = event.endsAt ? Date.parse(event.endsAt) : start;
  const startsInside = start >= from && start < to;
  const inProgressInside = start <= now && now < end && now >= from && now < to;
  return startsInside || inProgressInside;
};

// The slider goes from 1 to 10 km: 10 means "any distance"
export const matchesDistance = (event: EventView, maxDistance: number): boolean =>
  maxDistance >= 10 || event.distanceKm <= maxDistance;

// The filters GET /api/events understands. null: the category does not exist on the server,
// so no event can match it and the request is skipped
export const toServerQuery = (
  filters: EventFilters,
): { search?: string; category?: string; status?: string } | null => {
  if (filters.category !== 'all' && !SERVER_CATEGORIES.includes(filters.category)) return null;

  const query: { search?: string; category?: string; status?: string } = {};
  if (filters.search.trim()) query.search = filters.search.trim();
  if (filters.category !== 'all') query.category = filters.category;
  if (filters.status !== 'all') query.status = filters.status;
  return query;
};

// Map screen search + LIVE/OPEN chips
export const filterMapEvents = (
  events: EventView[],
  query: string,
  status: 'all' | 'live' | 'open',
): EventView[] => {
  const q = query.trim().toLowerCase();
  return events.filter((item) => {
    const matchesQuery =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.venueName.toLowerCase().includes(q) ||
      item.mapLabel.toLowerCase().includes(q);
    return matchesQuery && (status === 'all' || item.status === status);
  });
};
