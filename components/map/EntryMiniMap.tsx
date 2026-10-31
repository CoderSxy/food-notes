'use client';

import { MapContainer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { setupDefaultMarkerIcons } from '@/components/map/leafletSetup';
import MapTileLayer from '@/components/map/MapTileLayer';
import MapErrorBoundary from '@/components/map/MapErrorBoundary';

export type EntryMiniMapProps = { lat: number; lng: number; name: string };

export default function EntryMiniMap({ lat, lng, name }: EntryMiniMapProps) {
  setupDefaultMarkerIcons();
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  return (
    <div className="map-panel map-panel--mini panel" data-testid="entry-mini-map">
      <MapErrorBoundary>
        <MapContainer
          center={[lat, lng]}
          zoom={15}
          className="map-canvas map-canvas--mini"
          scrollWheelZoom={false}
          dragging
        >
          <MapTileLayer />
          <Marker position={[lat, lng]} title={name} />
        </MapContainer>
      </MapErrorBoundary>
      <p className="muted map-panel__caption">
        <a href={osmLink} target="_blank" rel="noreferrer">在 OpenStreetMap 打开</a>
      </p>
    </div>
  );
}
