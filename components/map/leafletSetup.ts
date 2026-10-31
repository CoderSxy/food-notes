import L from 'leaflet';

let done = false;

/** Fix default marker icons under Next/webpack (missing image URLs). */
export function setupDefaultMarkerIcons(): void {
  if (done || typeof window === 'undefined') return;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
  done = true;
}
