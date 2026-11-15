"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PrivateRoute } from "@/components/PrivateRoute/PrivateRoute";
import { IconBack } from "@/components/Icons/Icons";
import { useProducts } from "@/contexts/ProductsProvider";
import { usePayments } from "@/contexts/PaymentsProvider";
import { FALLBACK_EVENT_IMAGE } from "@/lib/eventMappers";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loadProductById, selectedProduct, loadingProduct, productError } = useProducts();
  const { getActivePayment, reserveTicket, reservingId, loading: loadingPayments } = usePayments();
  const ticket = selectedProduct ? getActivePayment(selectedProduct.id) : null;
  const reserving = selectedProduct !== null && reservingId === selectedProduct.id;

  useEffect(() => {
    if (params.id) void loadProductById(params.id);
  }, [params.id, loadProductById]);

  return (
    <PrivateRoute>
      <section className="screen detail">
        {loadingProduct ? <p className="status-box">Loading product...</p> : null}
        {!loadingProduct && !selectedProduct ? (
          <div className="empty">
            <p>{productError || "This product id does not exist."}</p>
            <button className="btn" onClick={() => router.push("/home")}>
              Back to Home
            </button>
          </div>
        ) : null}
        {selectedProduct ? (
          <>
            <div className="hero-photo">
              <Image
                src={selectedProduct.imageUrl || selectedProduct.event.imageUrl || FALLBACK_EVENT_IMAGE}
                alt={selectedProduct.name}
                width={400}
                height={250}
                priority
                unoptimized
              />
              <div className="float-actions">
                <button className="round" onClick={() => router.back()} aria-label="Back">
                  <IconBack />
                </button>
              </div>
            </div>
            <div className="capacity-row">
              <h1>{selectedProduct.name}</h1>
            </div>
            <p className="muted">{selectedProduct.event.venueName}</p>
            <p>{selectedProduct.description}</p>
            <p>
              <strong>
                {selectedProduct.price} {selectedProduct.currency}
              </strong>
            </p>
            {ticket ? (
              <p className="status-box" role="status">
                {ticket.status === "paid"
                  ? "You have this ticket (paid)."
                  : "Ticket reserved. Payment is pending: no charge has been made."}
              </p>
            ) : (
              <button
                className="btn"
                type="button"
                disabled={reserving || loadingPayments}
                onClick={() => void reserveTicket(selectedProduct.id)}
              >
                {reserving ? "Reserving..." : "Get Ticket"}
              </button>
            )}
          </>
        ) : null}
      </section>
    </PrivateRoute>
  );
}
