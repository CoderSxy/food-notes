'use client';

import { useEffect } from 'react';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationValue } from '@/components/LocationField';
import { DEFAULT_CENTER } from '@/lib/geo/map';
import { setupDefaultMarkerIcons } from '@/components/map/leafletSetup';
import MapTileLayer from '@/components/map/MapTileLayer';
import MapErrorBoundary from '@/components/map/MapErrorBoundary';

export type LocationPickerMapProps = {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

function parseCoord(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function MapViewSync({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.setView([lat, lng], zoom, { animate: false });
  }, [map, lat, lng, zoom]);
  return null;
}

function ClickAndDragMarker({
  position,
  onChange,
}: {
  position: [number, number] | null;
  onChange: (value: LocationValue) => void;
}) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onChange({ lat: String(e.latlng.lat), lng: String(e.latlng.lng) });
    },
  });
  if (!position) return null;
  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          onChange({ lat: String(lat), lng: String(lng) });
        },
      }}
    />
  );
}

export default function LocationPickerMap({ value, onChange }: LocationPickerMapProps) {
  setupDefaultMarkerIcons();
  const lat = parseCoord(value.lat);
  const lng = parseCoord(value.lng);
  const hasPoint = lat !== null && lng !== null
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const centerLat = hasPoint ? lat : DEFAULT_CENTER.lat;
  const centerLng = hasPoint ? lng : DEFAULT_CENTER.lng;
  const zoom = hasPoint ? 15 : 4;

  return (
    <div className="map-panel map-panel--picker" data-testid="location-picker-map">
      <p className="muted map-panel__hint">
        {hasPoint ? '可拖动钉子或点击地图调整位置。' : '点击地图放置钉子，也可拖动调整；亦可使用定位或手填经纬度。'}
      </p>
      <MapErrorBoundary>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={zoom}
          className="map-canvas map-canvas--picker"
          scrollWheelZoom
        >
          <MapTileLayer />
          <MapViewSync lat={centerLat} lng={centerLng} zoom={zoom} />
          <ClickAndDragMarker
            position={hasPoint ? [lat, lng] : null}
            onChange={onChange}
          />
        </MapContainer>
      </MapErrorBoundary>
    </div>
  );
}
