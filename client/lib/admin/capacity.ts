export type CapacityTag = '' | 'FULL' | 'ALMOST FULL';

const ALMOST_FULL_PERCENT = 80;

export const getCapacityPercent = (attendees: number, capacity: number): number => {
  if (capacity === 0) return 0;
  return Math.round((attendees / capacity) * 100);
};

export const getCapacityTag = (percent: number): CapacityTag => {
  if (percent >= 100) return 'FULL';
  if (percent >= ALMOST_FULL_PERCENT) return 'ALMOST FULL';
  return '';
};
