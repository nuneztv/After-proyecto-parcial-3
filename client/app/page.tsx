"use client";

import { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { AfterLogo } from "@/components/AfterLogo/AfterLogo";

// Welcome screen: only the After logo, until the user clicks or taps anywhere. Then the Client
// login (which already sends a signed-in user on to /home, and links to the Admin login)
export default function WelcomePage() {
  const router = useRouter();

  // Capture phase: the logo is itself a button that goes to /home, so the click is taken here
  // before it reaches it and the whole screen behaves the same
  const onContinue = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    router.push("/login");
  };

  return (
    <section className="screen auth splash" onClickCapture={onContinue} aria-label="After. Tap to continue">
      <AfterLogo tagline={false} />
      <div className="spinner" aria-label="Loading After" />
    </section>
  );
}
