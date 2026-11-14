
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
  distance: string;
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
  id: number;
  eventId: string;
  time: string;
  message: string;
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
