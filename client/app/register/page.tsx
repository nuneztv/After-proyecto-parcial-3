"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AfterLogo } from "@/components/AfterLogo";
import { IconLock, IconMail, IconPerson } from "@/components/Icons";
import { useAuth } from "@/contexts/AuthProvider";
import { validateRegister } from "@/lib/validation";

export default function RegisterPage() {
  const { register, loading, error, clearError } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const problem = formError || error;

  // An error left by the login screen does not belong to this form
  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setNotice("");
    const invalid = validateRegister({ fullName, email, password, confirmPassword });
    setFormError(invalid ?? "");
    if (invalid) {
      clearError();
      return;
    }

    const result = await register({ fullName: fullName.trim(), email: email.trim(), password });
    if (result === "confirm") {
      setNotice("Check your email to confirm your account, then log in");
    }
  };

  return (
    <section className="screen auth">
      <AfterLogo />
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        {problem ? (
          <p className="form-error" role="alert">
            {problem}
          </p>
        ) : null}
        {notice ? <p className="status-box">{notice}</p> : null}
        <label className="field">
          <span className="icon-soft">
            <IconPerson />
          </span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            autoComplete="name"
            aria-label="Full name"
          />
        </label>
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
        <label className="field">
          <span className="icon-soft">
            <IconLock />
          </span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="new-password"
            aria-label="Password"
          />
        </label>
        <label className="field">
          <span className="icon-soft">
            <IconLock />
          </span>
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            type="password"
            autoComplete="new-password"
            aria-label="Confirm password"
          />
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
      <div className="divider">Or sign up with</div>
      <div className="social-row">
        <button className="social" type="button">
          Google
        </button>
        <button className="social" type="button">
          Apple
        </button>
      </div>
      <Link className="auth-link" href="/login">
        Already have an account? Log in
      </Link>
    </section>
  );
}
