'use client';

import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { Logo } from '../Logo/Logo';

interface AuthFormProps {
  label?: string;
  submitText: string;
  loadingText: string;
  loading: boolean;
  error?: string | null;
  footerText: string;
  footerLinkText: string;
  footerHref: string;
  onSubmit: () => void;
  children: ReactNode;
}

// Shell shared by the admin login and register screens. The form owns preventDefault,
// so callers receive onSubmit() without DOM events.
export const AuthForm = ({
  label,
  submitText,
  loadingText,
  loading,
  error,
  footerText,
  footerLinkText,
  footerHref,
  onSubmit,
  children,
}: AuthFormProps) => {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!loading) onSubmit();
  };

  return (
    <div className="auth">
      <Logo />
      {label && <p className="auth__label">{label}</p>}

      <form className="auth__card" onSubmit={handleSubmit} noValidate aria-busy={loading}>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {children}
        <button type="submit" className="btn" disabled={loading}>
          {loading ? loadingText : submitText}
        </button>
      </form>

      <p className="auth__footer">
        {footerText} <Link href={footerHref}>{footerLinkText}</Link>
      </p>
    </div>
  );
};
