import Boom from '@hapi/boom';
import { LoginDTO, OAUTH_PROVIDERS, OAuthProvider, OAuthSessionDTO, RegisterDTO } from './auth.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;
const FULL_NAME_MAX_LENGTH = 80;

const requireEmail = (value: unknown): string => {
  if (typeof value !== 'string' || !EMAIL_PATTERN.test(value.trim())) {
    throw Boom.badRequest('A valid email is required');
  }

  return value.trim().toLowerCase();
};

export const parseLoginBody = (body: unknown): LoginDTO => {
  const { email, password } = (body ?? {}) as Record<string, unknown>;

  if (typeof password !== 'string' || !password) {
    throw Boom.badRequest('Password is required');
  }

  return { email: requireEmail(email), password };
};

export const parseRegisterBody = (body: unknown): RegisterDTO => {
  const { email, password, fullName } = (body ?? {}) as Record<string, unknown>;

  if (typeof fullName !== 'string' || !fullName.trim()) {
    throw Boom.badRequest('Full name is required');
  }

  if (fullName.trim().length > FULL_NAME_MAX_LENGTH) {
    throw Boom.badRequest(`Full name must be at most ${FULL_NAME_MAX_LENGTH} characters`);
  }

  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw Boom.badRequest(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  return { email: requireEmail(email), password, fullName: fullName.trim() };
};

export const parseRefreshBody = (body: unknown): string => {
  const { refreshToken } = (body ?? {}) as Record<string, unknown>;

  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw Boom.badRequest('Refresh token is required');
  }

  return refreshToken;
};

export const parseForgotPasswordBody = (body: unknown): string => {
  const { email } = (body ?? {}) as Record<string, unknown>;

  return requireEmail(email);
};

export const parseResetPasswordBody = (body: unknown): string => {
  const { password } = (body ?? {}) as Record<string, unknown>;

  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw Boom.badRequest(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  return password;
};

export const parseOAuthProvider = (value: unknown): OAuthProvider => {
  if (typeof value !== 'string' || !(OAUTH_PROVIDERS as readonly string[]).includes(value)) {
    throw Boom.badRequest('Unsupported sign-in provider');
  }

  return value as OAuthProvider;
};

export const parseOAuthSessionBody = (body: unknown): OAuthSessionDTO => {
  const { accessToken, refreshToken, expiresAt } = (body ?? {}) as Record<string, unknown>;

  if (typeof accessToken !== 'string' || !accessToken || typeof refreshToken !== 'string' || !refreshToken) {
    throw Boom.badRequest('Sign-in tokens are required');
  }

  const expires = Number(expiresAt);
  if (!Number.isFinite(expires) || expires <= 0) {
    throw Boom.badRequest('Invalid session expiry');
  }

  return { accessToken, refreshToken, expiresAt: expires };
};
