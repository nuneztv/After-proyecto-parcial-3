import type {
  Activity,
  AfterEvent,
  ApiActivity,
  ApiEvent,
  ApiEventStatus,
  CreateEventInput,
  EventDraft,
  EventStatus,
} from './types';

const TIME_ZONE = 'America/Bogota';
const FALLBACK_IMAGE = '/images/brand/logo-after.png';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: TIME_ZONE,
});

// The admin app groups the stored statuses into three operational buckets
export const toAdminStatus = (status: ApiEventStatus): EventStatus => {
  if (status === 'live') return 'live';
  if (status === 'closed') return 'closed';
  return 'upcoming';
};

const toDate = (iso: string | null): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatEventDate = (iso: string): string => {
  const date = toDate(iso);
  return date ? dateFormatter.format(date) : '';
};

// "6:00 pm"; empty string when there is no (valid) time
export const formatEventTime = (iso: string | null): string => {
  const date = toDate(iso);
  return date ? timeFormatter.format(date).replace(/\s/g, ' ').toLowerCase() : '';
};

export const toAfterEvent = (event: ApiEvent): AfterEvent => ({
  id: event.id,
  name: event.title,
  description: event.description,
  date: formatEventDate(event.startsAt),
  startTime: formatEventTime(event.startsAt),
  endTime: formatEventTime(event.endsAt),
  location: event.venueName,
  address: event.address,
  startsAt: event.startsAt,
  latitude: event.latitude,
  longitude: event.longitude,
  image: event.imageUrl ?? FALLBACK_IMAGE,
  status: toAdminStatus(event.status),
  attendees: event.occupied,
  capacity: event.capacity,
});

export const toActivity = (activity: ApiActivity): Activity => ({
  id: activity.id,
  eventId: activity.eventId,
  time: formatEventTime(activity.createdAt),
  message: activity.message,
  createdAt: activity.createdAt,
});

// Bogota has no daylight saving time, so the offset of TIME_ZONE is always -05:00
const BOGOTA_OFFSET = '-05:00';

// 'YYYY-MM-DD' of the following day, computed in UTC so the local time zone never shifts it
const nextDay = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

const toBogotaIso = (date: string, time: string): string => `${date}T${time}:00${BOGOTA_OFFSET}`;

// Expects a draft that passed validateEventDraft (location set, capacity numeric)
export const toCreateEventInput = (draft: EventDraft): CreateEventInput => {
  if (!draft.location) throw new Error('Select the location on the map');

  // Nightlife events often end after midnight: an end time at or before the start is the next day
  const endDate = draft.endTime && draft.endTime <= draft.time ? nextDay(draft.date) : draft.date;

  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    venueName: draft.venueName.trim(),
    startsAt: toBogotaIso(draft.date, draft.time),
    endsAt: draft.endTime ? toBogotaIso(endDate, draft.endTime) : null,
    latitude: draft.location.latitude,
    longitude: draft.location.longitude,
    capacity: Number(draft.capacity.trim()),
    imageUrl: draft.imageUrl,
  };
};
