"use client";
import { useRef, useState } from "react";
import type { TileLayer as LeafletTileLayer } from "leaflet";
import { TileLayer } from "react-leaflet";
import { OSM_ATTRIBUTION, OSM_TILE_URL } from "@/lib/geo/map";
export default function MapTileLayer() {
  const layer = useRef<LeafletTileLayer>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  return (
    <>
      <TileLayer
        ref={layer}
        attribution={OSM_ATTRIBUTION}
        url={OSM_TILE_URL}
        maxZoom={19}
        eventHandlers={{
          loading: () => {
            setFailed(false);
            setLoading(true);
          },
          load: () => setLoading(false),
          tileerror: () => setFailed(true),
        }}
      />
      {loading && !failed && (
        <div className="map-loading-status" role="status">
          底图加载中，记录点位可先查看。
        </div>
      )}
      {failed && (
        <div className="map-tile-warning" role="status">
          <span>部分底图未能加载，记录点位仍可查看。</span>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setFailed(false);
              layer.current?.redraw();
            }}
          >
            重试底图
          </button>
        </div>
      )}
    </>
  );
}
