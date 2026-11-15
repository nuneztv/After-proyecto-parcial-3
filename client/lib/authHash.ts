// Supabase sends users back from a reset email or a Google/Apple sign-in with the result in the
// URL fragment: "#access_token=...&refresh_token=...&expires_at=...&type=recovery" or
// "#error=access_denied&error_description=...". The fragment never reaches any server.

export type AuthHashResult =
  | {
      kind: 'session';
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      // "recovery" for a password-reset link
      type: string | null;
    }
  | { kind: 'error'; message: string }
  | { kind: 'empty' };

// Only these fixed texts are ever shown: error_description comes from the URL, so anyone could
// craft a link that puts their own text on the screen
const GENERIC_ERROR = 'Sign-in failed, please try again';
const FRIENDLY_ERRORS: Record<string, string> = {
  access_denied: 'Sign-in was cancelled',
  otp_expired: 'This link is invalid or has expired. Please request a new one.',
};

export const parseAuthHash = (hash: string): AuthHashResult => {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  const error = params.get('error_code') || params.get('error');
  if (error) {
    return { kind: 'error', message: FRIENDLY_ERRORS[error] ?? GENERIC_ERROR };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return { kind: 'empty' };

  // Some flows only send expires_in (seconds from now)
  const expiresAt =
    Number(params.get('expires_at')) ||
    Math.floor(Date.now() / 1000) + (Number(params.get('expires_in')) || 3600);

  return { kind: 'session', accessToken, refreshToken, expiresAt, type: params.get('type') };
};
