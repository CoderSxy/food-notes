export type LatLng = { lat: number; lng: number };
export function haversineKm(a: LatLng, b: LatLng): number {
 const rad = (d: number) => d * Math.PI / 180;
 const h = Math.sin(rad(b.lat-a.lat)/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
 return 12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
