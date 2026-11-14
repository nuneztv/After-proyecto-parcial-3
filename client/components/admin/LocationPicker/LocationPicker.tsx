'use client';

import { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CALI_CENTER } from '@/lib/admin/map';
import type { MapPinData } from '@/lib/admin/map';
import type { EventLocation } from '@/lib/admin/types';

const INITIAL_ZOOM = 14;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// Leaflet's default marker images break under bundlers: the picked point is a CSS divIcon
const pickedIcon = L.divIcon({
  className: 'location-picker__marker',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface LocationPickerProps {
  // Existing events, shown as small reference markers
  events: MapPinData[];
  value: EventLocation | null;
  onPick: (location: EventLocation) => void;
}

// Must be loaded with next/dynamic({ ssr: false }): Leaflet touches window on import
export const LocationPicker = ({ events, value, onPick }: LocationPickerProps) => {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickedRef = useRef<L.Marker | null>(null);
  // The map is created once; the latest callback and start point are read through refs
  const onPickRef = useRef(onPick);
  const initialValue = useRef(value);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Keyboard path: arrow keys pan the map (Leaflet's keyboard handler), then the center is picked
  const pickCenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    onPickRef.current({ latitude: center.lat, longitude: center.lng });
  }, []);

  useEffect(() => {
    const container = box.current;
    if (!container) return;

    const start = initialValue.current ?? CALI_CENTER;
    const map = L.map(container, { attributionControl: false, zoomControl: false }).setView(
      [start.latitude, start.longitude],
      INITIAL_ZOOM,
    );
    // Top-left is taken by the page's back button
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer(TILE_URL).addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => {
      onPickRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });
    mapRef.current = map;

    // Leaflet makes the container focusable; Enter/Space there picks the center. Only when the
    // container itself has focus, so keys on the zoom buttons keep their own behavior
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== container || (event.key !== 'Enter' && event.key !== ' ')) return;
      // Space would otherwise scroll the page
      event.preventDefault();
      pickCenter();
    };
    container.addEventListener('keydown', handleKeyDown);

    // The container only gets its final size after layout settles (dynamic import, fonts, CSS):
    // re-measure on every resize so the tiles always cover the whole box
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      pickedRef.current = null;
    };
  }, [pickCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layer = L.layerGroup().addTo(map);
    events.forEach((event) => {
      L.circleMarker([event.latitude, event.longitude], {
        radius: 7,
        className: 'location-picker__event',
        // Clicks go through to the map, so a point next to an existing venue can still be picked
        interactive: false,
      })
        .bindTooltip(event.mapLabel, {
          permanent: true,
          direction: 'top',
          offset: [0, -6],
          className: 'location-picker__label',
        })
        .addTo(layer);
    });

    return () => {
      layer.remove();
    };
  }, [events]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!value) {
      pickedRef.current?.remove();
      pickedRef.current = null;
      return;
    }

    const position: L.LatLngExpression = [value.latitude, value.longitude];
    if (pickedRef.current) pickedRef.current.setLatLng(position);
    else pickedRef.current = L.marker(position, { icon: pickedIcon, keyboard: false }).addTo(map);
  }, [value]);

  return (
    <>
      <div
        ref={box}
        className="location-picker"
        role="application"
        aria-label="Map: tap to select the event location, or use the arrow keys and press Enter to pick the center"
      />
      {/* Outside the map container: a click here must not also reach Leaflet's map click */}
      <button type="button" className="location-picker__center" onClick={pickCenter}>
        Use map center
      </button>
    </>
  );
};
