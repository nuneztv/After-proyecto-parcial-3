'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAxios } from './AxiosProvider';
import { useAuth } from './AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import type { Payment } from '@/types/models';

interface PaymentsContextType {
  // Payments of the signed-in user only (the server scopes them by the token)
  payments: Payment[];
  // Distinct events with a paid ticket (the profile "Visited" counter)
  visitedCount: number;
  loading: boolean;
  error: string;
  reloadPayments: () => Promise<void>;
}

const PaymentsContext = createContext<PaymentsContextType | null>(null);

export const PaymentsProvider = ({ children }: { children: ReactNode }) => {
  const axios = useAxios();
  const { user } = useAuth();
  // The id, not the object: GET /api/auth/me replaces the user object without changing who it is
  const userId = user?.id;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reloadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get<Payment[]>('/api/payments');
      setPayments(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [axios]);

  useEffect(() => {
    if (!userId) return;
    // The fetch is the external system this effect syncs with: the list only changes once the
    // API answers (the loading flag is the only synchronous update)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadPayments();
  }, [userId, reloadPayments]);

  const visitedCount = useMemo(
    () =>
      new Set(
        payments
          .filter((payment) => payment.status === 'paid')
          .map((payment) => payment.product.event.id),
      ).size,
    [payments],
  );

  const value = useMemo(
    () => ({ payments, visitedCount, loading, error, reloadPayments }),
    [payments, visitedCount, loading, error, reloadPayments],
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
};

export const usePayments = () => {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error('usePayments must be used within PaymentsProvider');
  return ctx;
};
