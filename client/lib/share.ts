import type { EventView } from '@/types/models';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

// Native share sheet on phones (Web Share API); elsewhere the link is copied to the clipboard
export const shareEvent = async (
  event: Pick<EventView, 'title' | 'venueName'>,
  url: string,
): Promise<ShareResult> => {
  const data = { title: event.title, text: `${event.title} at ${event.venueName}`, url };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      // Closing the share sheet is not an error worth reporting
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
};

// Walking route from the user's current position, opened in Google Maps
export const walkingDirectionsUrl = (event: Pick<EventView, 'latitude' | 'longitude'>): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}&travelmode=walking`;

