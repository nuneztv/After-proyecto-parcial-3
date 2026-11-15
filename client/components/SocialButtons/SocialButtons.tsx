'use client';

import { useAuth } from '@/contexts/AuthProvider';
import type { OAuthProvider } from '@/types/models';

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'apple', label: 'Apple' },
];

// Google/Apple sign-in through Supabase OAuth. A provider that is not enabled in the Supabase
// project yet answers with a clear message, shown by the login/register form like any auth error
export const SocialButtons = () => {
  const { startOAuth, loading } = useAuth();

  return (
    <div className="social-row">
      {PROVIDERS.map((provider) => (
        <button
          key={provider.id}
          className="social"
          type="button"
          disabled={loading}
          onClick={() => void startOAuth(provider.id)}
        >
          {provider.label}
        </button>
      ))}
    </div>
  );
};
