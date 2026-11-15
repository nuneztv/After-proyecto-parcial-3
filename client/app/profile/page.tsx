"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppScreen } from "@/components/AppScreen/AppScreen";
import { PrivateRoute } from "@/components/PrivateRoute/PrivateRoute";
import { IconBell, IconGear, IconHeart, IconHelp } from "@/components/Icons/Icons";
import { BadgesPanel } from "@/components/BadgesPanel/BadgesPanel";
import { NotificationsPanel } from "@/components/NotificationsPanel/NotificationsPanel";
import { SettingsPanel } from "@/components/SettingsPanel/SettingsPanel";
import { HelpPanel } from "@/components/HelpPanel/HelpPanel";
import { useAuth } from "@/contexts/AuthProvider";
import { usePayments } from "@/contexts/PaymentsProvider";
import { useSavedEvents } from "@/contexts/SavedEventsProvider";
import { useNotifications } from "@/contexts/NotificationsProvider";
import { computeBadges } from "@/lib/badges";

type Panel = "badges" | "notifications" | "settings" | "help" | null;

export default function ProfilePage() {
  const { user, logout, loggingOut } = useAuth();
  const { payments, visitedCount } = usePayments();
  const { savedIds } = useSavedEvents();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);

  // From the user's real favorites and payments (lib/badges.ts)
  const badges = useMemo(
    () =>
      computeBadges({
        savedCount: savedIds.length,
        ticketCount: payments.filter((item) => item.status !== "failed").length,
        visitedCount,
      }),
    [savedIds.length, payments, visitedCount]
  );
  const unlockedBadges = badges.filter((badge) => badge.unlocked).length;

  const toggle = (next: Exclude<Panel, null>) => {
    setPanel((current) => (current === next ? null : next));
    if (next === "notifications") markAllRead();
  };

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
            <Image className="avatar" src={user.avatarUrl} alt={user.fullName} width={108} height={108} unoptimized />
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
          <div
            role="button"
            tabIndex={0}
            aria-label={`${unlockedBadges} badges unlocked. Show badges`}
            onClick={() => toggle("badges")}
            onKeyDown={(e) => {
              if (e.key === "Enter") toggle("badges");
            }}
          >
            <strong>{unlockedBadges}</strong>
            Badges
          </div>
        </div>
        {panel === "badges" ? <BadgesPanel badges={badges} /> : null}
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
        <button className="menu-card" onClick={() => toggle("notifications")}>
          <span className="menu-icon">
            <IconBell />
          </span>
          <span style={{ flex: 1 }}>
            <strong>Notifications</strong>
            <p className="muted">
              {unreadCount > 0
                ? `${unreadCount} new update${unreadCount === 1 ? "" : "s"}`
                : "Event updates and alerts"}
            </p>
          </span>
          <span className="chevron">›</span>
        </button>
        {panel === "notifications" ? (
          <NotificationsPanel
            notifications={notifications}
            onOpenEvent={(id) => router.push(`/events/${id}`)}
          />
        ) : null}
        <button className="menu-card" onClick={() => toggle("settings")}>
          <span className="menu-icon">
            <IconGear />
          </span>
          <span style={{ flex: 1 }}>
            <strong>Settings</strong>
            <p className="muted">Location, privacy, preferences</p>
          </span>
          <span className="chevron">›</span>
        </button>
        {panel === "settings" ? <SettingsPanel /> : null}
        <button className="menu-card" onClick={() => toggle("help")}>
          <span className="menu-icon">
            <IconHelp />
          </span>
          <span style={{ flex: 1 }}>
            <strong>Help & Support</strong>
            <p className="muted">FAQ, contact us</p>
          </span>
          <span className="chevron">›</span>
        </button>
        {panel === "help" ? <HelpPanel /> : null}
        <button className="btn logout-btn" onClick={() => void logout()} disabled={loggingOut}>
          {loggingOut ? "Logging out..." : "Log Out"}
        </button>
      </AppScreen>
    </PrivateRoute>
  );
}
