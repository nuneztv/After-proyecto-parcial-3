
export type EventStatus = 'live' | 'upcoming' | 'closed';

export interface AfterEvent {
  id: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  address: string;
  // ISO timestamps from the API; the display fields above are derived from them
  startsAt: string;
  endsAt: string | null;
  latitude: number;
  longitude: number;
  // Display source: the stored image or the brand fallback
  image: string;
  // Stored value (null when the event has no image); the edit form starts from it
  imageUrl: string | null;
  status: EventStatus;
  attendees: number;
  capacity: number;
}

export interface EventStats {
  peopleNow: number;
  activeEvents: number;
  eventsToday: number;
  capacityPercent: number;
}

export interface Activity {
  id: string;
  eventId: string;
  // Display time ("6:00 pm"), derived from createdAt
  time: string;
  message: string;
  createdAt: string;
  // Present when the row came from a read endpoint; status already mapped for the admin
  event?: {
    id: string;
    name: string;
    status: EventStatus;
  };
}

// Stored status as the API returns it (shared with the user app, unmapped)
export type ApiEventStatus = 'live' | 'open' | 'almost-full' | 'closed';

// Mirrors the server's Event (GET /api/events, GET /api/events/:id)
export interface ApiEvent {
  id: string;
  title: string;
  description: string;
  venueName: string;
  address: string;
  imageUrl: string | null;
  categories: string[];
  status: ApiEventStatus;
  startsAt: string;
  endsAt: string | null;
  latitude: number;
  longitude: number;
  capacity: number;
  occupied: number;
  rating: number;
  section: 'happening' | 'tonight' | 'trending' | null;
  mapLabel: string | null;
  createdAt: string;
}

// Event a feed row belongs to, nested by the server with json_build_object
export interface ApiActivityEvent {
  id: string;
  title: string;
  status: ApiEventStatus;
}

// Mirrors the server's EventActivity. The read endpoints (GET /api/events/activity,
// GET /api/events/:id/activity) add `event`; the PATCH occupancy response does not
export interface ApiActivity {
  id: string;
  eventId: string;
  message: string;
  createdAt: string;
  event?: ApiActivityEvent;
}

// View model used by the admin screens (header, avatar, profile page)
export interface Profile {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  initials: string;
  avatar: string | null;
}

export type Role = 'client' | 'admin';

// Mirrors the server's Profile (GET /api/auth/me, login and register responses)
export interface AdminUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  // Unix seconds
  expiresAt: number;
}

export interface AuthResponse {
  user: AdminUser;
  // null when Supabase requires email confirmation before the first login
  session: AuthTokens | null;
}

export interface AdminSession extends AuthTokens {
  user: AdminUser;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export interface EventLocation {
  latitude: number;
  longitude: number;
}

// Values of the event form (create or edit), kept as typed by the admin (strings) until submit
export interface EventDraft {
  title: string;
  description: string;
  venueName: string;
  // 'YYYY-MM-DD' (input type="date")
  date: string;
  // 'HH:mm' (input type="time")
  time: string;
  // 'YYYY-MM-DD' of the end, or '' for "same night" (the next day when endTime <= time)
  endDate: string;
  // 'HH:mm' or '' when the event has no end time
  endTime: string;
  capacity: string;
  location: EventLocation | null;
  // Public URL returned by POST /api/uploads/images, or null when no image was uploaded
  imageUrl: string | null;
}

// Text fields of the draft (set from inputs); location and imageUrl have their own setters
export type EventDraftField = Exclude<keyof EventDraft, 'location' | 'imageUrl'>;

// Field errors of the draft, keyed by field; an empty object means the draft is valid
export type EventDraftErrors = Partial<Record<keyof EventDraft, string>>;

// Body of POST /api/events (mirrors the server's CreateEventDTO)
export interface CreateEventInput {
  title: string;
  description: string;
  venueName: string;
  // ISO 8601 with offset, e.g. '2026-11-20T22:00:00-05:00'
  startsAt: string;
  endsAt: string | null;
  latitude: number;
  longitude: number;
  capacity: number;
  // Must be an image this admin uploaded (POST /api/uploads/images); null means no image
  imageUrl?: string | null;
}

// Body of PATCH /api/events/:id. The admin form always sends every editable field;
// address, categories, status and occupied are not editable here (the API rejects them)
export interface UpdateEventInput extends Omit<CreateEventInput, 'imageUrl'> {
  // The unchanged current URL is always accepted; a new one must be an image this admin uploaded
  imageUrl: string | null;
}

// One draft per form: 'new' for the create form, `edit:<event id>` for each edit form
export type DraftKey = 'new' | `edit:${string}`;

// Response of POST /api/uploads/images
export interface ApiUploadedImage {
  url: string;
}

// Response of PATCH /api/events/:id/occupancy
export interface ApiOccupancyUpdate {
  event: ApiEvent;
  activity: ApiActivity;
}
