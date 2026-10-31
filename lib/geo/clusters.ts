import type { MapPoint } from "@/lib/entry-types";
export type PointCluster = {
  key: string;
  lat: number;
  lng: number;
  points: MapPoint[];
};
export function clusterPoints(
  points: MapPoint[],
  project: (p: MapPoint) => { x: number; y: number },
  size = 48,
): PointCluster[] {
  const groups = new Map<string, MapPoint[]>();
  for (const point of points) {
    const p = project(point);
    const key = `${Math.floor(p.x / size)}:${Math.floor(p.y / size)}`;
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }
  return [...groups].map(([key, items]) => ({
    key,
    lat: items.reduce((v, p) => v + p.lat, 0) / items.length,
    lng: items.reduce((v, p) => v + p.lng, 0) / items.length,
    points: items,
  }));
}
