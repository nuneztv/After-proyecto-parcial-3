'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAxios } from './AxiosProvider';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
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
  // The pending or paid payment the user already has for a ticket, if any
  getActivePayment: (productId: string) => Payment | null;
  // Product id whose reservation request is in flight
  reservingId: string | null;
  // "Get Ticket": creates a pending reservation (no charge); null when it failed
  reserveTicket: (productId: string) => Promise<Payment | null>;
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
  const [reservingId, setReservingId] = useState<string | null>(null);
  const { showToast } = useToast();

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

  const getActivePayment = useCallback(
    (productId: string) =>
      payments.find(
        (payment) =>
          payment.productId === productId && (payment.status === 'pending' || payment.status === 'paid'),
      ) ?? null,
    [payments],
  );

  const reserveTicket = useCallback(
    async (productId: string) => {
      if (reservingId) return null;
      setReservingId(productId);

      try {
        const { data } = await axios.post<{ payment: Payment; created: boolean }>('/api/payments', {
          productId,
        });
        // Replaces an older copy of the same payment, newest first like GET /api/payments
        setPayments((prev) => [data.payment, ...prev.filter((item) => item.id !== data.payment.id)]);
        showToast(
          data.created
            ? 'Ticket reserved. Payment is pending.'
            : 'You already have this ticket reserved',
          data.created ? 'success' : 'info',
        );
        return data.payment;
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
        return null;
      } finally {
        setReservingId(null);
      }
    },
    [axios, reservingId, showToast],
  );

  const value = useMemo(
    () => ({
      payments,
      visitedCount,
      loading,
      error,
      reloadPayments,
      getActivePayment,
      reservingId,
      reserveTicket,
    }),
    [payments, visitedCount, loading, error, reloadPayments, getActivePayment, reservingId, reserveTicket],
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
};

export const usePayments = () => {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error('usePayments must be used within PaymentsProvider');
  return ctx;
};
