'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/admin/axios';
import { getErrorMessage } from '@/lib/admin/errors';
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  getAdminSession,
  setAdminSession,
} from '@/lib/admin/storage';
import type { AdminUser, AuthResponse, RegisterInput } from '@/lib/admin/types';
import { useToast } from './ToastProvider';

interface AdminAuthContextType {
  user: AdminUser | null;
  // true once the stored session has been read (avoids redirecting before hydration)
  ready: boolean;
  // a login or register request is in flight
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

const LOGIN_PATH = '/admin/login';
const HOME_PATH = '/admin/overview';

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  // Restore the session, then confirm it with the API (a 401 there triggers the refresh flow)
  useEffect(() => {
    const stored = getAdminSession();
    setUser(stored?.user ?? null);
    setReady(true);

    if (!stored) return;

    const onInit = async () => {
      try {
        const { data } = await adminApi.get<AdminUser>('/api/auth/me');
        const current = getAdminSession();

        if (current) {
          setAdminSession({ ...current, user: data });
          setUser(data);
        }
      } catch {
        // Network/server errors keep the stored session; expiry is handled by the event below
      }
    };

    void onInit();
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      showToast('Your session expired, please log in again', 'error');
      router.replace(LOGIN_PATH);
    };

    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
  }, [router, showToast]);

  const startSession = useCallback((data: AuthResponse) => {
    if (!data.session) return;

    setAdminSession({ ...data.session, user: data.user });
    setUser(data.user);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);

    try {
      const { data } = await adminApi.post<AuthResponse>('/api/auth/admin/login', { email, password });
      startSession(data);
      showToast(`Welcome back, ${data.user.fullName.split(' ')[0]}`, 'success');
      router.replace(HOME_PATH);
      return true;
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (input: RegisterInput) => {
    setLoading(true);

    try {
      const { data } = await adminApi.post<AuthResponse>('/api/auth/admin/register', input);

      if (data.session) {
        startSession(data);
        showToast('Your administrator account is ready', 'success');
        router.replace(HOME_PATH);
      } else {
        showToast('Check your email to confirm your account, then log in', 'info');
        router.replace(LOGIN_PATH);
      }

      return true;
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAdminSession(null);
    setUser(null);
    showToast('You have logged out', 'info');
    router.replace(LOGIN_PATH);
  };

  return (
    <AdminAuthContext.Provider value={{ user, ready, loading, login, register, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
};
