
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
  // ISO timestamp from the API; the display fields above are derived from it
  startsAt: string;
  latitude: number;
  longitude: number;
  image: string;
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

// Mirrors the server's EventActivity (GET /api/events/activity, GET /api/events/:id/activity)
export interface ApiActivity {
  id: string;
  eventId: string;
  message: string;
  createdAt: string;
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
