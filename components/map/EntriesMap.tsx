'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { MapContainer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Entry } from '@/lib/entries';
import {
  DEFAULT_CENTER,
  filterByOwnerScope,
  filterMappableEntries,
  type OwnerScope,
} from '@/lib/geo/map';
import { setupDefaultMarkerIcons } from '@/components/map/leafletSetup';
import MapTileLayer from '@/components/map/MapTileLayer';
import FitBounds from '@/components/map/FitBounds';
import MapErrorBoundary from '@/components/map/MapErrorBoundary';

export type EntriesMapProps = {
  entries: Entry[];
  userId: string;
  scope: OwnerScope;
};

export default function EntriesMap({ entries, userId, scope }: EntriesMapProps) {
  setupDefaultMarkerIcons();
  const points = useMemo(
    () => filterMappableEntries(filterByOwnerScope(entries, scope, userId)),
    [entries, scope, userId],
  );

  if (!points.length) {
    return (
      <div className="map-panel map-panel--overview panel empty" role="status">
        <h2>地图上还没有足迹</h2>
        <p className="muted">
          {scope === 'mine'
            ? '你还没有带坐标的记录。去记一笔，或切换到「全部」看看大家的足迹。'
            : '当前没有带坐标的记录。去记一笔，把味道钉在地图上吧。'}
        </p>
        <Link href="/entries/new">去记一笔 →</Link>
      </div>
    );
  }

  return (
    <div className="map-panel map-panel--overview panel" data-testid="entries-map">
      <MapErrorBoundary>
        <MapContainer
          center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
          zoom={5}
          className="map-canvas"
          scrollWheelZoom
        >
          <MapTileLayer />
          <FitBounds points={points} />
          {points.map((entry) => (
            <Marker key={entry.id} position={[entry.lat, entry.lng]}>
              <Popup>
                <strong>{entry.name}</strong>
                <div>{entry.rating} 分</div>
                <Link href={`/entries/${entry.id}`}>查看详情 →</Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </MapErrorBoundary>
    </div>
  );
}
