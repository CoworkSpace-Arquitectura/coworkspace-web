'use client';

import { useEffect, useRef } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  subtitle?: string;
  href?: string;
}

interface Props {
  points: MapPoint[];
  /** Si se pasa, el mapa es editable: clic o arrastrar el pin cambia la ubicación. */
  onPick?: (latitude: number, longitude: number) => void;
  height?: number;
  zoom?: number;
  label: string;
}

// Centro de respaldo cuando aún no hay puntos: Montería
const FALLBACK: [number, number] = [8.7479, -75.8814];

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Mapa de OpenStreetMap con Leaflet. Leaflet usa "window", así que se carga
 * solo en el navegador (import dinámico dentro de useEffect).
 */
export function LocationMap({ points, onPick, height = 320, zoom = 16, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const editable = Boolean(onPick);

  // Crear el mapa una sola vez
  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then(({ default: L }) => {
      if (cancelled || !container.current || map.current) {
        return;
      }
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView(FALLBACK, 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(instance);
      if (editable) {
        instance.on('click', (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
      }
      layer.current = L.layerGroup().addTo(instance);
      map.current = instance;
      draw(L);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redibujar los pines cuando cambian
  useEffect(() => {
    if (map.current) {
      void import('leaflet').then(({ default: L }) => draw(L));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  function draw(L: typeof import('leaflet')) {
    const instance = map.current;
    const group = layer.current;
    if (!instance || !group) {
      return;
    }
    group.clearLayers();
    const icon = L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [30, 40], iconAnchor: [15, 38], popupAnchor: [0, -34] });

    for (const point of points) {
      const marker = L.marker([point.latitude, point.longitude], { icon, draggable: editable, title: point.title });
      if (editable) {
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng();
          pickRef.current?.(lat, lng);
        });
      } else if (point.title) {
        const title = escapeHtml(point.title);
        const subtitle = point.subtitle ? `<br><span>${escapeHtml(point.subtitle)}</span>` : '';
        marker.bindPopup(point.href ? `<a href="${point.href}"><strong>${title}</strong></a>${subtitle}` : `<strong>${title}</strong>${subtitle}`);
      }
      marker.addTo(group);
    }

    if (points.length === 1) {
      instance.setView([points[0].latitude, points[0].longitude], Math.max(instance.getZoom(), zoom));
    } else if (points.length > 1) {
      instance.fitBounds(
        L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number])),
        { padding: [40, 40], maxZoom: 14 },
      );
    }
  }

  return <div ref={container} className="map" style={{ height }} role="region" aria-label={label} />;
}
