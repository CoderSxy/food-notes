import type { Entry } from '@/lib/entries';
import type { LatLng } from '@/lib/geo/haversine';

export type OwnerScope = 'mine' | 'all';
export type MappableEntry = Entry & { lat: number; lng: number };

/** Approximate geographic center of China — used when no coords yet. */
export const DEFAULT_CENTER: LatLng = { lat: 35.8617, lng: 104.1954 };

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function hasCoords(
  entry: Pick<Entry, 'lat' | 'lng'>,
): entry is { lat: number; lng: number } {
  return typeof entry.lat === 'number' && typeof entry.lng === 'number';
}

export function filterMappableEntries(entries: Entry[]): MappableEntry[] {
  return entries.filter(hasCoords) as MappableEntry[];
}

export function filterByOwnerScope(
  entries: Entry[],
  scope: OwnerScope,
  userId: string,
): Entry[] {
  if (scope === 'all') return entries;
  return entries.filter((entry) => entry.user_id === userId);
}
