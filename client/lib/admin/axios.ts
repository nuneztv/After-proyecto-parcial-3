import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './config';
import { expireAdminSession, getAdminSession, updateAdminTokens } from './storage';
import type { AuthTokens } from './types';

// Single axios instance for the admin app
export const adminApi = axios.create({ baseURL: API_URL, timeout: 12000 });

adminApi.interceptors.request.use((config) => {
  const session = getAdminSession();

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return config;
});

// Several requests can fail with 401 at once: they all wait for one refresh call
let refreshing: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const session = getAdminSession();
  if (!session?.refreshToken) return null;

  try {
    // Plain axios, not adminApi: the refresh call must not go through these interceptors
    const { data } = await axios.post<AuthTokens>(`${API_URL}/api/auth/refresh`, {
      refreshToken: session.refreshToken,
    });
    updateAdminTokens(data);
    return data.accessToken;
  } catch {
    return null;
  }
};

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

adminApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    // Login/register answer 401 for wrong credentials: that is not an expired session. Logout is
    // also excluded: refreshing a session that is being ended would only extend it
    const isAuthRoute = original?.url?.startsWith('/api/auth/') && !original.url.endsWith('/me');

    if (error.response?.status !== 401 || !original || original._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    original._retry = true;
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null;
    });
    const token = await refreshing;

    if (!token) {
      // AdminAuthProvider listens to this event: it clears the user and redirects to login
      expireAdminSession();
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${token}`;
    return adminApi(original);
  },
);
