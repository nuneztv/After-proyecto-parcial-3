"use client";

import { useRouter } from "next/navigation";
import { AppScreen } from "@/components/AppScreen/AppScreen";
import { PrivateRoute } from "@/components/PrivateRoute/PrivateRoute";
import { IconBell, IconGear, IconHeart, IconHelp } from "@/components/Icons/Icons";
import { useAuth } from "@/contexts/AuthProvider";
import { usePayments } from "@/contexts/PaymentsProvider";
import { useSavedEvents } from "@/contexts/SavedEventsProvider";
import { useState } from "react";

export default function ProfilePage() {
  const { user, logout, loggingOut } = useAuth();
  const { visitedCount } = usePayments();
  const { savedIds } = useSavedEvents();
  const router = useRouter();
  const [panel, setPanel] = useState("");

  // PrivateRoute must still render without a user: it is what redirects to /login
  if (!user) return <PrivateRoute>{null}</PrivateRoute>;

  return (
    <PrivateRoute>
      <AppScreen>
        <h1 className="page-title" style={{ textAlign: "center" }}>
          Profile
        </h1>
        <div className="profile-hero">
          {user.avatarUrl ? (
            <img className="avatar" src={user.avatarUrl} alt={user.fullName} />
          ) : (
            <div className="avatar" style={{ display: "grid", placeItems: "center", background: "#f3d4f6" }}>
              {user.fullName.slice(0, 1)}
            </div>
          )}
          <h2>{user.fullName}</h2>
          <p className="muted">@{user.username}</p>
        </div>
        <div className="stats">
          <div>
            <strong>{savedIds.length}</strong>
            Saved
          </div>
          <div>
            <strong>{visitedCount}</strong>
            Visited
          </div>
          <div>
            <strong>2</strong>
            Badges
          </div>
        </div>
        <button className="menu-card" onClick={() => router.push("/saved-events")}>
          <span className="menu-icon">
            <IconHeart />
          </span>
          <span style={{ flex: 1 }}>
            <strong>My Events</strong>
            <p className="muted">See your upcoming events</p>
          </span>
          <span className="chevron">›</span>
        </button>
        <button className="menu-card" onClick={() => setPanel("Notifications")}>
          <span className="menu-icon">
            <IconBell />
          </span>
          <span style={{ flex: 1 }}>
            <strong>Notifications</strong>
            <p className="muted">Event updates and alerts</p>
          </span>
          <span className="chevron">›</span>
        </button>
        <button className="menu-card" onClick={() => setPanel("Settings")}>
          <span className="menu-icon">
            <IconGear />
          </span>
          <span style={{ flex: 1 }}>
            <strong>Settings</strong>
            <p className="muted">Location, privacy, preferences</p>
          </span>
          <span className="chevron">›</span>
        </button>
        <button className="menu-card" onClick={() => setPanel("Help & Support")}>
          <span className="menu-icon">
            <IconHelp />
          </span>
          <span style={{ flex: 1 }}>
            <strong>Help & Support</strong>
            <p className="muted">FAQ, contact us</p>
          </span>
          <span className="chevron">›</span>
        </button>
        {panel ? <p className="status-box">{panel}</p> : null}
        <button className="btn logout-btn" onClick={() => void logout()} disabled={loggingOut}>
          {loggingOut ? "Logging out..." : "Log Out"}
        </button>
      </AppScreen>
    </PrivateRoute>
  );
}
