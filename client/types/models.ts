export type EventStatus = "live" | "open" | "almost-full" | "closed";

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  description: string;
  imageUrl: string;
  place: string;
}

export type Role = "client" | "admin";

// Mirrors the server's Profile (GET /api/auth/me and the auth responses)
export interface UserProfile {
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

// session is null when Supabase "Confirm email" is on: the account exists but cannot log in yet
export interface AuthResponse {
  user: UserProfile;
  session: AuthTokens | null;
}

export interface StoredSession extends AuthTokens {
  user: UserProfile;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface Payment {
  id: string;
  clientId: string;
  productId: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed";
  createdAt: string;
}

export type EventSection = "happening" | "tonight" | "trending";

// Mirrors the server's Event (GET /api/events, GET /api/events/:id). Dates are ISO strings
export interface ApiEvent {
  id: string;
  title: string;
  description: string;
  venueName: string;
  address: string;
  imageUrl: string | null;
  categories: string[];
  status: EventStatus;
  startsAt: string;
  endsAt: string | null;
  latitude: number;
  longitude: number;
  capacity: number;
  occupied: number;
  rating: number;
  section: EventSection | null;
  mapLabel: string | null;
  createdAt: string;
}

// Legacy mock shape, still used by lib/events.ts and the mock admin providers on this branch
export interface EventItem {
  id: string;
  title: string;
  venueName: string;
  address: string;
  imageUrl: string;
  categories: string[];
  status: EventStatus;
  displayDate: string;
  displayTime: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  capacity: number;
  occupied: number;
  rating: number;
  description: string;
  section: EventSection;
  mapLabel: string;
}

// What the user app renders: an ApiEvent plus the values formatted by lib/eventMappers.ts
export interface EventView {
  id: string;
  title: string;
  venueName: string;
  address: string;
  imageUrl: string;
  categories: string[];
  status: EventStatus;
  startsAt: string;
  endsAt: string | null;
  displayDate: string;
  displayTime: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  capacity: number;
  occupied: number;
  rating: number;
  description: string;
  section: EventSection | null;
  mapLabel: string;
}

export interface EventFilters {
  search: string;
  category: string;
  status: string;
  time: string;
  maxDistance: number;
}
