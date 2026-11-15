'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastViewport } from '@/components/admin/ToastViewport/ToastViewport';
import type { Toast, ToastType } from '@/lib/admin/types';

const TOAST_DURATION_MS = 4000;

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));

    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = nextId.current++;

      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current.set(id, setTimeout(() => dismissToast(id), TOAST_DURATION_MS));
    },
    [dismissToast],
  );

  useEffect(() => {
    const pending = timers.current;

    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
