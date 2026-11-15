"use client";

import { useRouter } from "next/navigation";

// tagline: the "Discover after dark" line under the large logo (the welcome screen shows the logo alone)
export const AfterLogo = ({ size = "lg", tagline = true }: { size?: "lg" | "sm"; tagline?: boolean }) => {
  const router = useRouter();
  const src = size === "sm" ? "/images/brand/logo-after-sm.png" : "/images/brand/logo-after.png";

  return (
    <button
      type="button"
      className={size === "sm" ? "logo-btn sm" : "logo-btn"}
      onClick={() => router.push("/home")}
      aria-label="Go to Home"
    >
      <img src={src} alt="After" />
      {size === "lg" && tagline ? <p className="tagline">Discover after dark</p> : null}
    </button>
  );
};
