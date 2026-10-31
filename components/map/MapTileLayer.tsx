'use client';

import { TileLayer } from 'react-leaflet';
import { OSM_ATTRIBUTION, OSM_TILE_URL } from '@/lib/geo/map';

export default function MapTileLayer() {
  return (
    <TileLayer
      attribution={OSM_ATTRIBUTION}
      url={OSM_TILE_URL}
      maxZoom={19}
    />
  );
}
