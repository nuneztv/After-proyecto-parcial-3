import type {
  Activity,
  AfterEvent,
  ApiActivity,
  ApiEvent,
  ApiEventStatus,
  CreateEventInput,
  EventDraft,
  EventStatus,
  UpdateEventInput,
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
  endsAt: event.endsAt,
  latitude: event.latitude,
  longitude: event.longitude,
  image: event.imageUrl ?? FALLBACK_IMAGE,
  imageUrl: event.imageUrl,
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
  // Only the read endpoints nest the event; the PATCH occupancy response leaves it out
  ...(activity.event && {
    event: {
      id: activity.event.id,
      name: activity.event.title,
      status: toAdminStatus(activity.event.status),
    },
  }),
});

// Bogota has no daylight saving time, so the offset of TIME_ZONE is always -05:00
const BOGOTA_OFFSET = '-05:00';

// 'YYYY-MM-DD' of the following day, computed in UTC so the local time zone never shifts it
const nextDay = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

const toBogotaIso = (date: string, time: string): string => `${date}T${time}:00${BOGOTA_OFFSET}`;

const toEndsAt = (draft: EventDraft): string | null => {
  if (!draft.endTime) return null;
  // An explicit end date allows events longer than 24 h (and keeps them when edited)
  if (draft.endDate) return toBogotaIso(draft.endDate, draft.endTime);
  // Same night: nightlife events often end after midnight, so an end time at or before the
  // start is the next day
  const endDate = draft.endTime <= draft.time ? nextDay(draft.date) : draft.date;
  return toBogotaIso(endDate, draft.endTime);
};

// Expects a draft that passed validateEventDraft (location set, capacity numeric).
// Create and edit send the same fields, so both bodies are built here
const toEventInput = (draft: EventDraft): UpdateEventInput => {
  if (!draft.location) throw new Error('Select the location on the map');

  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    venueName: draft.venueName.trim(),
    startsAt: toBogotaIso(draft.date, draft.time),
    endsAt: toEndsAt(draft),
    latitude: draft.location.latitude,
    longitude: draft.location.longitude,
    capacity: Number(draft.capacity.trim()),
    imageUrl: draft.imageUrl,
  };
};

export const toCreateEventInput = (draft: EventDraft): CreateEventInput => toEventInput(draft);

export const toUpdateEventInput = (draft: EventDraft): UpdateEventInput => toEventInput(draft);

// Always yields 'YYYY-MM-DD' and 24-hour 'HH:mm', the formats of <input type="date|time">
const draftPartsFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
});

// Date and time as the admin typed them in Bogota (the inverse of toBogotaIso)
const toBogotaParts = (iso: string | null): { date: string; time: string } | null => {
  const date = toDate(iso);
  if (!date) return null;

  const parts = Object.fromEntries(
    draftPartsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

// Starting values of the edit form. The end date is always filled from endsAt, so an event that
// ends days later keeps its real end when it is saved again
export const toEventDraft = (event: AfterEvent): EventDraft => {
  const start = toBogotaParts(event.startsAt);
  const end = toBogotaParts(event.endsAt);

  return {
    title: event.name,
    description: event.description,
    venueName: event.location,
    date: start?.date ?? '',
    time: start?.time ?? '',
    endDate: end?.date ?? '',
    endTime: end?.time ?? '',
    capacity: String(event.capacity),
    location: { latitude: event.latitude, longitude: event.longitude },
    imageUrl: event.imageUrl,
  };
};
