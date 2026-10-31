'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLng } from '@/lib/geo/haversine';

export default function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = points.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }, [map, points]);
  return null;
}
