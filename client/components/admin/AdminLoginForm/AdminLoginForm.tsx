'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/contexts/admin/AdminAuthProvider';
import { validateLogin } from '@/lib/admin/validation';
import { AuthForm } from '../AuthForm/AuthForm';
import { AuthInput } from '../AuthInput/AuthInput';

export const AdminLoginForm = () => {
  const { login, loading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const error = validateLogin(email, password);
    setFieldError(error);
    if (error) return;

    // The provider shows the API error as a toast and redirects on success
    await login(email.trim().toLowerCase(), password);
  };

  return (
    <AuthForm
      submitText="Log In"
      loadingText="Logging in..."
      loading={loading}
      error={fieldError}
      footerText="Don't have an account?"
      footerLinkText="Sign up"
      footerHref="/admin/register"
      onSubmit={handleSubmit}
    >
      <AuthInput
        icon="mail"
        type="email"
        placeholder="Email address"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        disabled={loading}
      />
      <AuthInput
        icon="lock"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        disabled={loading}
      />
      <span className="auth__forgot">Forgot password?</span>
    </AuthForm>
  );
};
