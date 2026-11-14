import type { RegisterInput } from './types';

// Same limits as server/src/features/auth/auth.validation.ts: the server stays the authority
export const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateLogin = (email: string, password: string): string | null => {
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address';
  if (!password) return 'Enter your password';
  return null;
};

export const validateRegister = (input: RegisterInput, confirmPassword: string): string | null => {
  if (!input.fullName.trim()) return 'Enter your full name';
  if (!EMAIL_PATTERN.test(input.email.trim())) return 'Enter a valid email address';
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (input.password !== confirmPassword) return 'Passwords do not match';
  return null;
};
