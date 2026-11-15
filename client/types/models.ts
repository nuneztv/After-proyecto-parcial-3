export type EventStatus = "live" | "open" | "almost-full" | "closed";

// The event nested in tickets and payments (json_build_object on the server)
export interface EventSummary {
  id: string;
  title: string;
  venueName: string;
  address: string;
  status: EventStatus;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
}

// GET /api/products: a ticket for an event. Prices are COP without decimals
export interface Product {
  id: string;
  eventId: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  description: string;
  imageUrl: string | null;
  event: EventSummary;
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

export type OAuthProvider = "google" | "apple";

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

// GET /api/payments: a purchase of the current user, with its ticket and event
export interface Payment {
  id: string;
  productId: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed";
  createdAt: string;
  product: {
    id: string;
    name: string;
    category: string;
    imageUrl: string | null;
    event: EventSummary;
  };
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

// GET /api/saved-events: a favorite of the current user, with its event nested by the server
export interface SavedEvent {
  eventId: string;
  savedAt: string;
  event: ApiEvent;
}
