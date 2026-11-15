"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AfterLogo } from "@/components/AfterLogo/AfterLogo";
import { IconMail } from "@/components/Icons/Icons";
import { useAuth } from "@/contexts/AuthProvider";
import { validateEmail } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const { requestPasswordReset, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const problem = formError || error;

  // An error left by another auth screen does not belong to this form
  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setSent(false);
    const invalid = validateEmail(email);
    setFormError(invalid ?? "");
    if (invalid) {
      clearError();
      return;
    }

    setSent(await requestPasswordReset(email.trim()));
  };

  return (
    <section className="screen auth">
      <AfterLogo />
      <h1 className="forgot-title">Forgot your password?</h1>
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        {problem ? (
          <p className="form-error" role="alert">
            {problem}
          </p>
        ) : null}
        {/* Same message whether or not the email has an account (the API does not reveal it) */}
        {sent ? (
          <p className="form-ok" role="status">
            If an account exists for {email.trim()}, we sent a link to reset your password. Check
            your inbox and spam folder.
          </p>
        ) : null}
        <label className="field">
          <span className="icon-soft">
            <IconMail />
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            autoComplete="email"
            aria-label="Email address"
          />
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Sending..." : sent ? "Send Again" : "Send Link"}
        </button>
      </form>
      <Link className="auth-link" href="/login">
        Already have an account? Log in
      </Link>
    </section>
  );
}
