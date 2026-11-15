import type { AppNotification } from '@/lib/notifications';

interface NotificationsPanelProps {
  notifications: AppNotification[];
  onOpenEvent: (eventId: string) => void;
}

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export const NotificationsPanel = ({ notifications, onOpenEvent }: NotificationsPanelProps) => {
  return (
    <section className="info-card profile-panel" aria-label="Notifications">
      <strong>Notifications</strong>
      {notifications.length === 0 ? (
        <p className="muted">
          No updates yet. New events and status changes of your saved events (for example when one
          goes LIVE) appear here while the app is open.
        </p>
      ) : (
        <ul className="panel-list">
          {notifications.map((item) => (
            <li key={item.id}>
              <button type="button" className="panel-item" onClick={() => onOpenEvent(item.eventId)}>
                <span>{item.message}</span>
                <span className="muted">{timeFormat.format(item.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
