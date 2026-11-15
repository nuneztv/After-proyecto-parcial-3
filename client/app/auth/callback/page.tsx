"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AfterLogo } from "@/components/AfterLogo/AfterLogo";
import { useAuth } from "@/contexts/AuthProvider";
import { parseAuthHash } from "@/lib/authHash";
import { LOGIN_PATH, getSafeNextPath } from "@/lib/redirect";
import { takeOAuthNext } from "@/lib/storage";

// Module scope, not a ref: starting the session re-creates the session providers (keyed by user
// id) and remounts this page, which would reset a ref and exchange the (already cleared) URL
// again. Coming back from Google/Apple is always a full page load, so this starts false each time
let callbackStarted = false;

// Google/Apple send the user back here (through Supabase) with the session in the URL fragment,
// or with an error when they cancelled or the provider refused
export default function AuthCallbackPage() {
  const router = useRouter();
  const { completeOAuth, showAuthError } = useAuth();
  useEffect(() => {
    // Also covers Strict Mode, which runs effects twice in development
    if (callbackStarted) return;
    callbackStarted = true;

    const result = parseAuthHash(window.location.hash);
    // Tokens never stay in the address bar or the history
    window.history.replaceState(null, "", window.location.pathname);
    const next = getSafeNextPath(takeOAuthNext());

    const finish = async () => {
      if (result.kind !== "session") {
        // The login page shows the reason (cancelled, provider error)
        showAuthError(result.kind === "error" ? result.message : "Sign-in did not complete");
        router.replace(LOGIN_PATH);
        return;
      }

      const ok = await completeOAuth({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
      });
      // On failure AuthProvider already set the error that /login displays
      router.replace(ok ? next : LOGIN_PATH);
    };

    void finish();
  }, [completeOAuth, showAuthError, router]);

  return (
    <section className="screen auth splash">
      <AfterLogo />
      <div className="spinner" aria-label="Signing you in" />
    </section>
  );
}
