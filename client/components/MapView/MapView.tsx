"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
interface MapTag {
  id: string;
  latitude: number;
  longitude: number;
  mapLabel: string;
}

interface MapViewProps {
  events?: MapTag[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  // Initial center [latitude, longitude]; defaults to central Cali
  center?: [number, number];
}

const CALI_CENTER: [number, number] = [3.4516, -76.532];

const labelPrefix = (label: string) => {
  if (label === "Rooftop") return "♪ ";
  if (label === "Drinks") return "🍸 ";
  return "";
};

export const MapView = ({ events = [], selectedId, onSelect, center = CALI_CENTER }: MapViewProps) => {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  // Only the first center is used: the map is created once and the user can pan it afterwards
  const initialCenter = useRef(center);

  // Kept in a ref so the map listeners (registered once) always call the latest callback
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = box.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, { attributionControl: false }).setView(initialCenter.current, 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    mapRef.current = map;

    const pick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest?.("[data-id]");
      const id = button?.getAttribute("data-id");
      if (id) onSelectRef.current?.(id);
    };
    container.addEventListener("click", pick);

    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("click", pick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layer = L.layerGroup().addTo(map);
    events.forEach((event) => {
      const selected = event.id === selectedId;
      const icon = L.divIcon({
        className: "map-label-icon",
        html: `<button type="button" data-id="${event.id}" class="map-label${selected ? " selected" : ""}">${labelPrefix(event.mapLabel)}${event.mapLabel}</button>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const marker = L.marker([event.latitude, event.longitude], { icon }).addTo(layer);
      marker.on("click", () => onSelectRef.current?.(event.id));
      marker.getElement()?.querySelector("button")?.addEventListener("click", () => {
        onSelectRef.current?.(event.id);
      });
    });

    return () => {
      layer.remove();
    };
  }, [events, selectedId]);

  return <div ref={box} className="leaflet-map" />;
};
