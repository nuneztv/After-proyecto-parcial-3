"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AfterLogo } from "@/components/AfterLogo/AfterLogo";
import { IconLock } from "@/components/Icons/Icons";
import { useAuth } from "@/contexts/AuthProvider";
import { AuthHashResult, parseAuthHash } from "@/lib/authHash";
import { validateNewPassword } from "@/lib/validation";

type LinkState = { status: "checking" } | { status: "invalid"; message: string } | { status: "ready"; token: string };

// Opened from the password-reset email: Supabase appends the recovery session to the URL fragment
export default function ResetPasswordPage() {
  const { resetPassword, loading, error, clearError } = useAuth();
  const [link, setLink] = useState<LinkState>({ status: "checking" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const problem = formError || error;
  // The fragment is read once: the effect clears it from the address bar, and Strict Mode runs
  // the effect a second time in development, which would otherwise find it empty
  const parsedLink = useRef<AuthHashResult | null>(null);

  useEffect(() => {
    clearError();
    parsedLink.current ??= parseAuthHash(window.location.hash);
    const result = parsedLink.current;
    // The token stays in memory only: it is removed from the address bar and history
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    // The URL fragment only exists in the browser, so it is read after hydration
    setLink(
      result.kind === "session" && result.type === "recovery"
        ? { status: "ready", token: result.accessToken }
        : {
            status: "invalid",
            message:
              result.kind === "error"
                ? result.message
                : "Open this page from the link in your password-reset email.",
          }
    );
  }, [clearError]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || link.status !== "ready") return;

    const invalid = validateNewPassword({ password, confirmPassword });
    setFormError(invalid ?? "");
    if (invalid) {
      clearError();
      return;
    }

    if (await resetPassword(link.token, password)) {
      setDone(true);
      setPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <section className="screen auth">
      <AfterLogo />
      <h1 className="forgot-title">Set a new password</h1>
      {link.status === "checking" ? <div className="spinner" aria-label="Loading" /> : null}
      {link.status === "invalid" ? (
        <div className="auth-card">
          <p className="form-error" role="alert">
            {link.message}
          </p>
          <Link className="btn" href="/forgot-password">
            Request a new link
          </Link>
        </div>
      ) : null}
      {link.status === "ready" && done ? (
        <div className="auth-card">
          <p className="form-ok" role="status">
            Your password was changed. Log in with your new password.
          </p>
          <Link className="btn" href="/login">
            Log In
          </Link>
        </div>
      ) : null}
      {link.status === "ready" && !done ? (
        <form className="auth-card" onSubmit={onSubmit} noValidate>
          {problem ? (
            <p className="form-error" role="alert">
              {problem}
            </p>
          ) : null}
          <label className="field">
            <span className="icon-soft">
              <IconLock />
            </span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              type="password"
              autoComplete="new-password"
              aria-label="New password"
            />
          </label>
          <label className="field">
            <span className="icon-soft">
              <IconLock />
            </span>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              type="password"
              autoComplete="new-password"
              aria-label="Confirm new password"
            />
          </label>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Password"}
          </button>
        </form>
      ) : null}
      <Link className="auth-link" href="/login">
        Back to Log in
      </Link>
    </section>
  );
}
