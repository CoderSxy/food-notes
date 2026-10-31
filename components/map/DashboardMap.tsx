"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { MapPoint } from "@/lib/entry-types";
import { clusterPoints } from "@/lib/geo/clusters";
import MapTileLayer from "./MapTileLayer";
import MapErrorBoundary from "./MapErrorBoundary";
import { DEFAULT_CENTER } from "@/lib/geo/map";
import Icon from "@/components/layout/Icon";
const foodSvg =
  '<path d="M5 3v7a3 3 0 0 0 6 0V3M8 3v18M19 3c-3 3-3 7 0 9v9M19 3v9"/>';
const itemSvg = '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9"/>';
function markerIcon(kind: string, count = 1) {
  return L.divIcon({
    className: "record-marker",
    html:
      count > 1
        ? `<span class="map-cluster">${count}</span>`
        : `<span class="map-pin ${kind}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${kind === "place" ? foodSvg : itemSvg}</svg></span>`,
    iconSize: [36, 40],
    iconAnchor: [18, 36],
    popupAnchor: [0, -32],
  });
}
function MapContent({
  points,
  complete,
  source,
  onSelect,
}: {
  points: MapPoint[];
  complete: boolean;
  source: string;
  onSelect: (points: MapPoint[]) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [message, setMessage] = useState("");
  const manual = useRef(false);
  const fitted = useRef(false);
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    dragstart: () => {
      manual.current = true;
    },
  });
  useEffect(() => {
    const node = map.getContainer();
    const intent = () => {
      manual.current = true;
    };
    node.addEventListener("wheel", intent);
    node.addEventListener("pointerdown", intent);
    return () => {
      node.removeEventListener("wheel", intent);
      node.removeEventListener("pointerdown", intent);
    };
  }, [map]);
  const fit = () => {
    if (points.length)
      map.fitBounds(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [36, 36], maxZoom: points.length === 1 ? 14 : 16 },
      );
  };
  useEffect(() => {
    map.invalidateSize();
    if (!points.length) return;
    if (!fitted.current || (complete && !manual.current)) {
      map.fitBounds(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [36, 36], maxZoom: points.length === 1 ? 14 : 16 },
      );
      fitted.current = true;
    }
  }, [points, complete, map]);
  const groups = useMemo(
    () => clusterPoints(points, (p) => map.project([p.lat, p.lng], zoom)),
    [points, map, zoom],
  );
  function locate() {
    manual.current = true;
    if (!navigator.geolocation) {
      setMessage("浏览器不支持定位，可继续查看记录");
      return;
    }
    setMessage("正在获取位置…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        map.setView([p.coords.latitude, p.coords.longitude], 14);
        setMessage("已定位到当前位置");
      },
      () => setMessage("无法获取位置，请检查定位权限；仍可浏览记录"),
      { timeout: 10000 },
    );
  }
  return (
    <>
      {groups.map((group) => (
        <Marker
          key={group.key}
          position={[group.lat, group.lng]}
          icon={markerIcon(group.points[0].kind, group.points.length)}
          eventHandlers={{
            click: () => {
              onSelect(group.points);
              if (group.points.length > 1) {
                const distinct = group.points.some(
                  (p) =>
                    p.lat !== group.points[0].lat ||
                    p.lng !== group.points[0].lng,
                );
                if (distinct && map.getZoom() < 18)
                  map.fitBounds(
                    group.points.map((p) => [p.lat, p.lng] as [number, number]),
                    {
                      padding: [48, 48],
                      maxZoom: Math.min(map.getZoom() + 3, 18),
                    },
                  );
              }
            },
          }}
        >
          {group.points.length === 1 && (
            <Popup>
              {group.points[0].cover_photo_url && (
                <img
                  className="map-cover"
                  src={group.points[0].cover_photo_url}
                  alt=""
                />
              )}
              <strong>{group.points[0].name}</strong>
              <p>
                {group.points[0].kind === "place" ? "餐饮" : "物品"} ·{" "}
                {group.points[0].rating} 分
              </p>
              <p>{group.points[0].address_text || "已记录位置"}</p>
              <Link
                href={`/entries/${group.points[0].id}?from=${encodeURIComponent(source)}`}
              >
                查看详情
              </Link>
            </Popup>
          )}
        </Marker>
      ))}
      <div className="map-tools">
        <button
          type="button"
          className="map-tool"
          onClick={locate}
          aria-label="定位到我"
        >
          <Icon name="locate" />
        </button>
        <button
          type="button"
          className="map-tool"
          onClick={() => {
            manual.current = false;
            fit();
          }}
          aria-label="查看全部点位"
        >
          <Icon name="expand" />
        </button>
      </div>
      {message && (
        <div className="map-message" role="status">
          {message}
        </div>
      )}
    </>
  );
}
export default function DashboardMap({
  points,
  complete,
  source,
}: {
  points: MapPoint[];
  complete: boolean;
  source: string;
}) {
  const [selected, setSelected] = useState<MapPoint[]>([]);
  return (
    <>
      <div className="dashboard-map">
        <MapErrorBoundary>
          <MapContainer
            center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
            zoom={4}
            className="map-canvas map-canvas--dashboard"
            scrollWheelZoom
          >
            <MapTileLayer />
            <MapContent
              points={points}
              complete={complete}
              source={source}
              onSelect={setSelected}
            />
          </MapContainer>
        </MapErrorBoundary>
        {complete && !points.length && (
          <div className="map-empty">
            <strong>当前范围还没有带位置的记录</strong>
            <Link href="/entries/new">增加第一条记录</Link>
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <section className="map-preview" aria-label="选中位置的记录">
          <div className="row between">
            <strong>
              {selected.length > 1
                ? `此处有 ${selected.length} 条记录`
                : "选中的记录"}
            </strong>
            <button
              className="icon-button"
              onClick={() => setSelected([])}
              aria-label="关闭记录预览"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="preview-list">
            {selected.map((point) => (
              <Link
                className="preview-row"
                key={point.id}
                href={`/entries/${point.id}?from=${encodeURIComponent(source)}`}
              >
                {point.cover_photo_url ? (
                  <img
                    className="preview-cover"
                    src={point.cover_photo_url}
                    alt=""
                  />
                ) : (
                  <span className={`category-icon ${point.kind}`}>
                    <Icon name={point.kind === "place" ? "food" : "item"} />
                  </span>
                )}
                <span>
                  <strong>{point.name}</strong>
                  <small>
                    {point.rating} 分 · {point.address_text || "已记录位置"}
                  </small>
                </span>
                <Icon name="arrow" size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
