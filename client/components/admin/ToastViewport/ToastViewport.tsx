import type { Toast } from '@/lib/admin/types';

interface ToastViewportProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export const ToastViewport = ({ toasts, onDismiss }: ToastViewportProps) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          <span className="toast__message">{toast.message}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
