import type { Badge } from '@/lib/badges';

interface BadgesPanelProps {
  badges: Badge[];
}

// Locked badges stay visible with their progress, so the user knows how to earn them
export const BadgesPanel = ({ badges }: BadgesPanelProps) => {
  return (
    <section className="info-card profile-panel" aria-label="Badges">
      <strong>Badges</strong>
      <ul className="panel-list">
        {badges.map((badge) => (
          <li key={badge.id} className={`panel-item ${badge.unlocked ? '' : 'locked'}`}>
            <span>
              <strong>{badge.name}</strong>
              <span className="muted"> · {badge.description}</span>
            </span>
            <span className="muted">{badge.unlocked ? 'Unlocked' : badge.progress}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
