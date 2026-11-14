'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/contexts/admin/AdminAuthProvider';
import { validateRegister } from '@/lib/admin/validation';
import { AuthForm } from '../AuthForm/AuthForm';
import { AuthInput } from '../AuthInput/AuthInput';

export const AdminRegisterForm = () => {
  const { register, loading } = useAdminAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const input = { fullName: fullName.trim(), email: email.trim().toLowerCase(), password };
    const error = validateRegister(input, confirmPassword);
    setFieldError(error);
    if (error) return;

    await register(input);
  };

  return (
    <AuthForm
      label="Administrator"
      submitText="Create Account"
      loadingText="Creating account..."
      loading={loading}
      error={fieldError}
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerHref="/admin/login"
      onSubmit={handleSubmit}
    >
      <AuthInput
        icon="user"
        type="text"
        placeholder="Full name"
        autoComplete="name"
        value={fullName}
        onChange={setFullName}
        disabled={loading}
      />
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
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        disabled={loading}
      />
      <AuthInput
        icon="lock"
        type="password"
        placeholder="Confirm password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        disabled={loading}
      />
    </AuthForm>
  );
};
