import Boom from '@hapi/boom';
import { LoginDTO, RegisterDTO } from './auth.types';

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
