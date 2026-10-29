import { createAdminClient } from '@/lib/supabase/admin';
import { haversineKm, type LatLng } from '@/lib/geo/haversine';
import { assertLeafCategoryIds, type Category } from '@/lib/categories';
import type { EntryCreate } from '@/lib/validations/entry';
export type DictionaryItem = { id: string; name: string };
export type Entry = {
  id: string; user_id: string; kind: 'place' | 'item'; name: string; note: string | null;
  rating: number; lat: number | null; lng: number | null; address_text: string | null;
  created_at: string; updated_at?: string;
  cuisines: DictionaryItem[]; categories: Category[]; tags: DictionaryItem[]; distanceKm?: number;
};
export type PlaceEntry = Entry & { kind: 'place'; lat: number; lng: number };
export const entrySelect = '*, entry_cuisines(cuisines(id,name)), entry_categories(categories(id,name,parent_id)), entry_tags(tags(id,name))';
type RawEntry = Omit<Entry, 'cuisines' | 'categories' | 'tags'> & {
  entry_cuisines: { cuisines: DictionaryItem }[];
  entry_categories: { categories: Category }[];
  entry_tags: { tags: DictionaryItem }[];
};
export function hydrateEntry(raw: RawEntry): Entry {
  const { entry_cuisines, entry_categories, entry_tags, ...entry } = raw;
  return { ...entry, cuisines: entry_cuisines.map(v => v.cuisines), categories: entry_categories.map(v => v.categories), tags: entry_tags.map(v => v.tags) };
}
export function isPlaceEntry(entry: Entry): entry is PlaceEntry {
  return entry.kind === 'place' && entry.lat !== null && entry.lng !== null;
}
export async function listEntries(filter: { kind?: Entry['kind'] } = {}, limit = 100): Promise<Entry[]> {
  let query = createAdminClient().from('entries').select(entrySelect);
  if (filter.kind) query = query.eq('kind', filter.kind);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as unknown as RawEntry[]).map(hydrateEntry);
}
export async function getEntry(id: string, kind?: Entry['kind']): Promise<Entry | null> {
  let query = createAdminClient().from('entries').select(entrySelect).eq('id', id);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? hydrateEntry(data as unknown as RawEntry) : null;
}
export async function nearbyPlaceEntries(point: LatLng, radiusKm = 5) {
  const { data, error } = await createAdminClient().from('entries').select(entrySelect)
    .eq('kind', 'place').not('lat', 'is', null).not('lng', 'is', null)
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data as unknown as RawEntry[]).map(hydrateEntry).filter(isPlaceEntry)
    .map(entry => ({ ...entry, distanceKm: haversineKm(point, entry) }))
    .filter(entry => entry.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
}
export async function createEntry(userId: string, parsed: EntryCreate) {
  if (parsed.kind === 'item') await assertLeafCategoryIds(parsed.categoryIds);
  const admin = createAdminClient();
  const { tagNames, ...rest } = parsed;
  // Keep associations out of the entries insert, even across kind switches.
  const fields = rest.kind === 'place'
    ? (({ cuisineIds: _ids, ...fields }) => fields)(rest)
    : (({ categoryIds: _ids, ...fields }) => fields)(rest);
  const { data: entry, error } = await admin.from('entries').insert({ ...fields, user_id: userId }).select('id').single();
  if (error) throw error;
  try {
    if (parsed.kind === 'place' && parsed.cuisineIds.length) {
      const { error } = await admin.from('entry_cuisines').insert(parsed.cuisineIds.map(cuisine_id => ({ entry_id: entry.id, cuisine_id })));
      if (error) throw error;
    }
    if (parsed.kind === 'item') {
      const { error } = await admin.from('entry_categories').insert(parsed.categoryIds.map(category_id => ({ entry_id: entry.id, category_id })));
      if (error) throw error;
    }
    if (tagNames.length) {
      const { data: tags, error } = await admin.from('tags').upsert(tagNames.map(name => ({ name })), { onConflict: 'name' }).select('id');
      if (error) throw error;
      const { error: joinError } = await admin.from('entry_tags').insert(tags.map(tag => ({ entry_id: entry.id, tag_id: tag.id })));
      if (joinError) throw joinError;
    }
    return await getEntry(entry.id);
  } catch (error) {
    const { error: cleanupError } = await admin.from('entries').delete().eq('id', entry.id).eq('user_id', userId);
    if (cleanupError) throw cleanupError;
    throw error;
  }
}
