import { getEventByIdService } from '../events/event.service';
import {
  deleteSavedEventRepository,
  findSavedEventsRepository,
  saveEventRepository,
} from './savedEvent.repository';
import { SavedEvent } from './savedEvent.types';

export const getSavedEventsService = async (userId: string): Promise<SavedEvent[]> =>
  findSavedEventsRepository(userId);

// 404 when the event does not exist; saving an already saved event is not an error
export const saveEventService = async (userId: string, eventId: string): Promise<void> => {
  await getEventByIdService(eventId);
  await saveEventRepository(userId, eventId);
};

// Idempotent like an HTTP DELETE: removing a favorite that is not there is not an error
export const unsaveEventService = async (userId: string, eventId: string): Promise<void> => {
  await deleteSavedEventRepository(userId, eventId);
};
