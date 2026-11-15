import { EventStatus } from '../events/event.types';

// The event a ticket or payment belongs to, nested by SQL (json_build_object)
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

// A ticket for an event. Prices are COP without decimals
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

export interface ProductFilters {
  // Only the tickets of this event; null = every ticket
  eventId: string | null;
}
