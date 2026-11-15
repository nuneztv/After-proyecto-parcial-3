"use client";

import { useRouter } from "next/navigation";
import { AppScreen } from "@/components/AppScreen/AppScreen";
import { PrivateRoute } from "@/components/PrivateRoute/PrivateRoute";
import { EventCard } from "@/components/EventCard/EventCard";
import { AfterLogo } from "@/components/AfterLogo/AfterLogo";
import { IconPin, IconSearch } from "@/components/Icons/Icons";
import { useSavedEvents } from "@/contexts/SavedEventsProvider";
import { useEvents } from "@/contexts/EventsProvider";

const categories = ["all", "music", "party", "rooftop", "bar"];

const statusLabel = (status: string) => {
  if (status === "open") return "OPEN";
  if (status === "almost-full") return "ALMOST FULL";
  return status.toUpperCase();
};

export default function HomePage() {
  const router = useRouter();
  const { events, happening, tonight, trending, loading, error, filters, setFilters } = useEvents();
  const { toggleSaved, savedIds } = useSavedEvents();

  const searching = filters.search.trim().length > 0;

  return (
    <PrivateRoute>
      <AppScreen>
        <div className="topbar">
          <AfterLogo size="sm" />
          <div className="city-pill">
            <IconPin />
            Cali, valle del cauca
          </div>
        </div>
        <div className="search-box">
          <IconSearch />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value, maxDistance: 10 })}
            placeholder="Search events, venues or categories ..."
            aria-label="Search events"
          />
        </div>
        <div className="chips">
          {categories.map((category) => (
            <button
              key={category}
              className={`chip ${filters.category === category ? "active" : ""}`}
              onClick={() => setFilters({ category })}
            >
              {category === "all" ? "All" : category[0].toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
        {loading ? <p className="status-box">Loading events...</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loading && events.length === 0 ? <p className="empty">No events match this search.</p> : null}
        {searching
          ? events.map((event) => (
              <EventCard key={event.id} event={event} onOpen={(id) => router.push(`/events/${id}`)} />
            ))
          : null}
        {!searching ? (
          <>
            <div className="section-head">
              <h2>Happening Now</h2>
              <button className="see-all" onClick={() => router.push("/search")}>
                See all
              </button>
            </div>
            {happening.map((event) => (
              <EventCard key={event.id} event={event} onOpen={(id) => router.push(`/events/${id}`)} />
            ))}
            <div className="section-head">
              <h2>Tonight&apos;s Pick ✨</h2>
            </div>
            <div className="tonight-grid">
              {tonight.slice(0, 2).map((event) => (
                <button
                  key={event.id}
                  className="mini-card"
                  onClick={() => router.push(`/events/${event.id}`)}
                >
                  <img src={event.imageUrl} alt={event.title} />
                  <span className={`mini-badge badge ${event.status}`}>{statusLabel(event.status)}</span>
                  <div className="overlay">
                    <h3>{event.title}</h3>
                    <p>
                      {event.venueName} · {event.distanceKm} km
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {trending ? (
              <article className="promo">
                <button className="promo-frame" onClick={() => router.push(`/events/${trending.id}`)}>
                  <img className="promo-art" src={trending.imageUrl} alt={trending.title} />
                </button>
                <button className="btn small promo-save" onClick={() => toggleSaved(trending.id)}>
                  {savedIds.includes(trending.id) ? "Saved" : "Save Event"}
                </button>
              </article>
            ) : null}
          </>
        ) : null}
      </AppScreen>
    </PrivateRoute>
  );
}
