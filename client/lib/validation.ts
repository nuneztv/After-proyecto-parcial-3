// Same rules as server/src/features/auth/auth.validation.ts, so the user sees the problem before
// the request. The server validates again: these checks are only feedback.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;
export const FULL_NAME_MAX_LENGTH = 80;

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterFormInput extends LoginInput {
  fullName: string;
  confirmPassword: string;
}

// Each validator returns the first problem found, or null when the input is valid
export const validateLogin = ({ email, password }: LoginInput): string | null => {
  if (!email.trim() || !password) return 'Please enter your email and password';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address';
  return null;
};

export interface NewPasswordInput {
  password: string;
  confirmPassword: string;
}

export const validateNewPassword = ({ password, confirmPassword }: NewPasswordInput): string | null => {
  if (!password || !confirmPassword) return 'Please fill in both fields';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};

export const validateEmail = (email: string): string | null => {
  if (!email.trim()) return 'Enter an email address';
  return EMAIL_PATTERN.test(email.trim()) ? null : 'Enter a valid email address';
};

export const validateRegister = ({
  fullName,
  email,
  password,
  confirmPassword,
}: RegisterFormInput): string | null => {
  if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
    return 'Please fill in all fields';
  }
  if (fullName.trim().length > FULL_NAME_MAX_LENGTH) {
    return `Full name must be at most ${FULL_NAME_MAX_LENGTH} characters`;
  }
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};
