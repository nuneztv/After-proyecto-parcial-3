import { Role } from '../../shared/types';
import { Profile } from '../profiles/profile.types';

export interface Session {
  accessToken: string;
  refreshToken: string;
  // Unix seconds
  expiresAt: number;
}

export interface AuthResponse {
  user: Profile;
  // null when Supabase "Confirm email" is enabled: the user must confirm before logging in
  session: Session | null;
}

export interface RegisterDTO {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthOptions {
  role: Role;
}

export const OAUTH_PROVIDERS = ['google', 'apple'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

// The tokens Supabase puts in the /auth/callback URL after a Google/Apple sign-in
export type OAuthSessionDTO = Session;
