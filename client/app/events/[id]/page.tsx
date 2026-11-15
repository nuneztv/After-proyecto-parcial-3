"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PrivateRoute } from "@/components/PrivateRoute/PrivateRoute";
import { StatusBadge } from "@/components/StatusBadge/StatusBadge";
import {
  IconBack,
  IconCalendar,
  IconCapacity,
  IconClock,
  IconHeart,
  IconPin,
  IconShare,
  IconStar,
} from "@/components/Icons/Icons";
import { useProducts } from "@/contexts/ProductsProvider";
import { useSavedEvents } from "@/contexts/SavedEventsProvider";
import { useEvents } from "@/contexts/EventsProvider";
import { useToast } from "@/contexts/ToastProvider";
import { shareEvent } from "@/lib/share";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loadEventById, selectedEvent, loadingEvent, eventError } = useEvents();
  const { getTicketForEvent } = useProducts();
  const { toggleSaved, savedIds } = useSavedEvents();
  const { showToast } = useToast();

  const onShare = async () => {
    if (!selectedEvent) return;
    const result = await shareEvent(selectedEvent, window.location.href);
    if (result === "copied") showToast("Event link copied", "success");
    if (result === "failed") showToast("Could not share this event", "error");
  };
  const product = selectedEvent ? getTicketForEvent(selectedEvent.id) : null;

  useEffect(() => {
    if (params.id) void loadEventById(params.id);
  }, [params.id, loadEventById]);

  return (
    <PrivateRoute>
      <section className="screen detail">
        {!selectedEvent && loadingEvent ? <p className="status-box">Loading event...</p> : null}
        {!selectedEvent && !loadingEvent ? (
          <div className="empty">
            <p>{eventError || "This event id does not exist."}</p>
            <button className="btn" onClick={() => router.push("/home")}>
              Back to Home
            </button>
          </div>
        ) : null}
        {selectedEvent ? (
          <>
            <div className="hero-photo">
              <Image src={selectedEvent.imageUrl} alt={selectedEvent.title} width={400} height={250} priority unoptimized />
              <div className="float-actions">
                <button className="round" onClick={() => router.back()} aria-label="Back">
                  <IconBack />
                </button>
                <div className="round-row">
                  <button className="round" aria-label="Share" type="button" onClick={() => void onShare()}>
                    <IconShare />
                  </button>
                  <button
                    className="round"
                    onClick={() => toggleSaved(selectedEvent.id)}
                    aria-label="Save event"
                  >
                    <IconHeart active={savedIds.includes(selectedEvent.id)} />
                  </button>
                </div>
              </div>
              <StatusBadge status={selectedEvent.status} />
            </div>
            <div className="capacity-row">
              <h1>{selectedEvent.title}</h1>
              <span className="rating">
                <IconStar /> {selectedEvent.rating}
              </span>
            </div>
            <p className="muted">{selectedEvent.venueName}</p>
            <div className="chips wrap">
              {selectedEvent.categories.map((category) => (
                <span key={category} className="chip active">
                  {category[0].toUpperCase() + category.slice(1)}
                </span>
              ))}
            </div>
            <p className="detail-copy">{selectedEvent.description}</p>
            <div className="info-card">
              <div className="info-line">
                <IconCalendar /> {selectedEvent.displayDate}
              </div>
              <div className="info-line">
                <IconClock /> {selectedEvent.displayTime}
              </div>
              <div className="info-line">
                <IconPin /> {selectedEvent.address}
              </div>
            </div>
            <div className="info-card capacity-row">
              <span className="info-line">
                <IconCapacity /> Current capacity
              </span>
              <strong>
                {selectedEvent.occupied}/{selectedEvent.capacity}
              </strong>
            </div>
            {product ? (
              <div
                className="info-card capacity-row"
                role="link"
                tabIndex={0}
                aria-label={`Ticket for ${selectedEvent.title}: ${product.price} ${product.currency}`}
                onClick={() => router.push(`/products/${product.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/products/${product.id}`);
                }}
              >
                <span>Ticket</span>
                <strong>
                  {product.price} {product.currency}
                </strong>
              </div>
            ) : null}
            <button className="btn" onClick={() => router.push(`/directions/${selectedEvent.id}`)}>
              Get Directions
            </button>
          </>
        ) : null}
      </section>
    </PrivateRoute>
  );
}
