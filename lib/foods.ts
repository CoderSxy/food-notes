// Compatibility helpers: legacy foods always refer to coordinate-bearing places.
import { getEntry, isPlaceEntry, listEntries, nearbyPlaceEntries } from '@/lib/entries';
export type { DictionaryItem } from '@/lib/entries';
// Preserve the old public shape for existing clients and AI fixtures.
export type Food = {
  id: string; user_id: string; name: string; note: string | null; rating: number;
  lat: number; lng: number; address_text: string | null; created_at: string;
  cuisines: { id: string; name: string }[]; tags: { id: string; name: string }[]; distanceKm?: number;
};
export async function listFoods(limit = 100) {
  return (await listEntries({ kind: 'place' }, limit)).filter(isPlaceEntry);
}
export async function getFood(id: string) {
  const entry = await getEntry(id, 'place');
  return entry && isPlaceEntry(entry) ? entry : null;
}
export const nearbyFoods = nearbyPlaceEntries;
