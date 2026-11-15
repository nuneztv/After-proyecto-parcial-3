"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppScreen } from "@/components/AppScreen/AppScreen";
import { PrivateRoute } from "@/components/PrivateRoute/PrivateRoute";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import { IconHeart } from "@/components/Icons/Icons";
import { useSavedEvents } from "@/contexts/SavedEventsProvider";

export default function SavedEventsPage() {
  const router = useRouter();
  const { savedEvents, savedVenues, savedIds, toggleSaved, loading, error, pendingIds } =
    useSavedEvents();
  const [tab, setTab] = useState<"events" | "venues">("events");

  return (
    <PrivateRoute>
      <AppScreen>
        <h1 className="page-title" style={{ textAlign: "center" }}>
          Saved Events
        </h1>
        <div className="tabs">
          <button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>
            Events
          </button>
          <button className={tab === "venues" ? "active" : ""} onClick={() => setTab("venues")}>
            Venues
          </button>
        </div>
        {loading ? <p className="status-box">Loading saved events...</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && tab === "events" && savedEvents.length === 0 ? (
          <p className="empty">You have no saved events yet. Save one from Home or Event Detail.</p>
        ) : null}
        {tab === "events"
          ? savedEvents.map((event) => (
              <article key={event.id} className="saved-card">
                <button className="ghost" onClick={() => router.push(`/events/${event.id}`)}>
                  <Image src={event.imageUrl} alt={event.title} width={74} height={74} unoptimized />
                </button>
                <button className="ghost" onClick={() => router.push(`/events/${event.id}`)}>
                  <div className="sheet-top">
                    <StatusBadge status={event.status} className="static" />
                    <span className="muted">
                      {event.distanceKm} km · {event.occupied}/{event.capacity}
                    </span>
                  </div>
                  <strong>{event.title}</strong>
                  <p className="muted">{event.venueName}</p>
                </button>
                <button
                  className="heart"
                  onClick={() => void toggleSaved(event.id)}
                  disabled={pendingIds.includes(event.id)}
                  aria-label="Remove from saved"
                >
                  <IconHeart active={savedIds.includes(event.id)} />
                </button>
              </article>
            ))
          : null}
        {tab === "venues"
          ? savedVenues.map((event) => (
              <article key={event.venueName} className="saved-card">
                <Image src={event.imageUrl} alt={event.venueName} width={74} height={74} unoptimized />
                <div>
                  <strong>{event.venueName}</strong>
                  <p className="muted">{event.address}</p>
                </div>
              </article>
            ))
          : null}
        {!loading && tab === "venues" && savedVenues.length === 0 ? (
          <p className="empty">No saved venues yet.</p>
        ) : null}
      </AppScreen>
    </PrivateRoute>
  );
}
