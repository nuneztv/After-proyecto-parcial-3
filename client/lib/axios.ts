import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './config';
import { getErrorMessage } from './errors';
import { expireStoredSession, getStoredSession, updateStoredTokens } from './storage';
import type { AuthTokens } from '@/types/models';

// Single axios instance for the user app (contexts/AxiosProvider only provides it)
export const api = axios.create({ baseURL: API_URL, timeout: 12000 });

api.interceptors.request.use((config) => {
  const session = getStoredSession();

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return config;
});

// Several requests can fail with 401 at once: they all wait for one refresh call
let refreshing: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const session = getStoredSession();
  if (!session?.refreshToken) return null;

  try {
    // Plain axios, not api: the refresh call must not go through these interceptors
    const { data } = await axios.post<AuthTokens>(`${API_URL}/api/auth/refresh`, {
      refreshToken: session.refreshToken,
    });
    updateStoredTokens(data);
    return data.accessToken;
  } catch {
    return null;
  }
};

// The providers show err.message, so the API's message replaces axios' generic one. The error
// stays an AxiosError, so callers can still read its status
const reject = (error: AxiosError): Promise<never> => {
  error.message = getErrorMessage(error);
  return Promise.reject(error);
};

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const isRefreshableRequest = (url: string | undefined): boolean => {
  if (!url?.startsWith('/api/auth/')) return true;
  // Login/register answer 401 for wrong credentials, which is not an expired session. Logout is
  // excluded too: refreshing a session that is being ended would only extend it
  return url === '/api/auth/me';
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      !isRefreshableRequest(original.url)
    ) {
      return reject(error);
    }

    original._retry = true;
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null;
    });
    const token = await refreshing;

    if (!token) {
      // AuthProvider listens to this event: it clears the user and redirects to /login
      expireStoredSession();
      return reject(error);
    }

    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);
