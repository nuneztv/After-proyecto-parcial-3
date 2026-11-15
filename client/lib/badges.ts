// Badges are computed from the user's real data (favorites and payments from Supabase): nothing is
// stored or granted by hand, so a badge can never claim something that did not happen

export interface BadgeStats {
  savedCount: number;
  // pending or paid tickets
  ticketCount: number;
  // distinct events with a paid ticket
  visitedCount: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  // "1/5" towards the goal
  progress: string;
}

interface BadgeRule {
  id: string;
  name: string;
  description: string;
  stat: keyof BadgeStats;
  goal: number;
}

export const BADGE_RULES: BadgeRule[] = [
  { id: 'first-save', name: 'First Save', description: 'Save your first event', stat: 'savedCount', goal: 1 },
  { id: 'collector', name: 'Collector', description: 'Save 5 events', stat: 'savedCount', goal: 5 },
  { id: 'ticket-holder', name: 'Ticket Holder', description: 'Reserve your first ticket', stat: 'ticketCount', goal: 1 },
  { id: 'night-owl', name: 'Night Owl', description: 'Go to an event with a paid ticket', stat: 'visitedCount', goal: 1 },
  { id: 'regular', name: 'Regular', description: 'Go to 3 different events', stat: 'visitedCount', goal: 3 },
];

export const computeBadges = (stats: BadgeStats): Badge[] =>
  BADGE_RULES.map((rule) => {
    const value = stats[rule.stat];
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      unlocked: value >= rule.goal,
      progress: `${Math.min(value, rule.goal)}/${rule.goal}`,
    };
  });
