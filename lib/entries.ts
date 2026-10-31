import { createAdminClient } from "@/lib/supabase/admin";
import { haversineKm, type LatLng } from "@/lib/geo/haversine";
import { assertLeafCategoryIds, type Category } from "@/lib/categories";
import type { EntryCreate } from "@/lib/validations/entry";
import {
  coverUrlFromPhotos,
  listPhotosForEntries,
  type EntryPhoto,
} from "@/lib/photos";
export type DictionaryItem = { id: string; name: string };
export type Entry = {
  id: string;
  user_id: string;
  kind: "place" | "item";
  name: string;
  note: string | null;
  rating: number;
  lat: number | null;
  lng: number | null;
  address_text: string | null;
  created_at: string;
  updated_at?: string;
  cuisines: DictionaryItem[];
  categories: Category[];
  tags: DictionaryItem[];
  distanceKm?: number;
  cover_photo_url?: string | null;
  photos?: EntryPhoto[];
};
export type PlaceEntry = Entry & { kind: "place"; lat: number; lng: number };
// PostgREST 14 embeds this self-FK by column. A constraint-name hint yields PGRST200.
export const entrySelect =
  "*, entry_cuisines(cuisines(id,name)), entry_categories(categories(id,name,parent_id,parent:parent_id(name))), entry_tags(tags(id,name))";
type RawEntry = Omit<Entry, "cuisines" | "categories" | "tags"> & {
  entry_cuisines: { cuisines: DictionaryItem }[];
  entry_categories: { categories: Category }[];
  entry_tags: { tags: DictionaryItem }[];
};
export function hydrateEntry(raw: RawEntry): Entry {
  const { entry_cuisines, entry_categories, entry_tags, ...entry } = raw;
  return {
    ...entry,
    cuisines: entry_cuisines.map((v) => v.cuisines),
    categories: entry_categories.map((v) => v.categories),
    tags: entry_tags.map((v) => v.tags),
  };
}
function groupPhotos(photos: EntryPhoto[]) {
  const grouped = new Map<string, EntryPhoto[]>();
  for (const photo of photos) {
    const list = grouped.get(photo.entry_id) ?? [];
    list.push(photo);
    grouped.set(photo.entry_id, list);
  }
  return grouped;
}
export async function attachPhotos<T extends Entry>(
  entries: T[],
  opts?: { full?: boolean },
): Promise<T[]> {
  if (!entries.length) return entries;
  const grouped = groupPhotos(
    await listPhotosForEntries(entries.map((entry) => entry.id)),
  );
  return entries.map((entry) => {
    const photos = grouped.get(entry.id) ?? [];
    return {
      ...entry,
      cover_photo_url: coverUrlFromPhotos(photos),
      ...(opts?.full ? { photos } : {}),
    };
  });
}
export async function attachCoverUrls<T extends { id: string }>(
  items: T[],
): Promise<(T & { cover_photo_url: string | null })[]> {
  if (!items.length)
    return items.map((item) => ({ ...item, cover_photo_url: null }));
  const grouped = groupPhotos(
    await listPhotosForEntries(items.map((item) => item.id)),
  );
  return items.map((item) => ({
    ...item,
    cover_photo_url: coverUrlFromPhotos(grouped.get(item.id) ?? []),
  }));
}
export function isPlaceEntry(entry: Entry): entry is PlaceEntry {
  return entry.kind === "place" && entry.lat !== null && entry.lng !== null;
}
export async function listEntries(
  filter: { kind?: Entry["kind"] } = {},
  limit = 100,
): Promise<Entry[]> {
  let query = createAdminClient().from("entries").select(entrySelect);
  if (filter.kind) query = query.eq("kind", filter.kind);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return attachPhotos((data as unknown as RawEntry[]).map(hydrateEntry));
}
export async function getEntry(
  id: string,
  kind?: Entry["kind"],
): Promise<Entry | null> {
  let query = createAdminClient()
    .from("entries")
    .select(entrySelect)
    .eq("id", id);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [entry] = await attachPhotos(
    [hydrateEntry(data as unknown as RawEntry)],
    { full: true },
  );
  return entry ?? null;
}
export async function nearbyPlaceEntries(
  point: LatLng,
  radiusKm = 5,
  userId?: string,
) {
  let query = createAdminClient()
    .from("entries")
    .select(entrySelect)
    .eq("kind", "place")
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const nearby = (data as unknown as RawEntry[])
    .map(hydrateEntry)
    .filter(isPlaceEntry)
    .map((entry) => ({ ...entry, distanceKm: haversineKm(point, entry) }))
    .filter((entry) => entry.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return attachPhotos(nearby);
}
export async function createEntry(userId: string, parsed: EntryCreate) {
  if (parsed.kind === "item") await assertLeafCategoryIds(parsed.categoryIds);
  const admin = createAdminClient();
  const { tagNames, ...rest } = parsed;
  // Keep associations out of the entries insert, even across kind switches.
  const fields =
    rest.kind === "place"
      ? (({ cuisineIds: _ids, ...fields }) => fields)(rest)
      : (({ categoryIds: _ids, ...fields }) => fields)(rest);
  const { data: entry, error } = await admin
    .from("entries")
    .insert({ ...fields, user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  try {
    if (parsed.kind === "place" && parsed.cuisineIds.length) {
      const { error } = await admin
        .from("entry_cuisines")
        .insert(
          parsed.cuisineIds.map((cuisine_id) => ({
            entry_id: entry.id,
            cuisine_id,
          })),
        );
      if (error) throw error;
    }
    if (parsed.kind === "item") {
      const { error } = await admin
        .from("entry_categories")
        .insert(
          parsed.categoryIds.map((category_id) => ({
            entry_id: entry.id,
            category_id,
          })),
        );
      if (error) throw error;
    }
    if (tagNames.length) {
      const { data: tags, error } = await admin
        .from("tags")
        .upsert(
          tagNames.map((name) => ({ name })),
          { onConflict: "name" },
        )
        .select("id");
      if (error) throw error;
      const { error: joinError } = await admin
        .from("entry_tags")
        .insert(tags.map((tag) => ({ entry_id: entry.id, tag_id: tag.id })));
      if (joinError) throw joinError;
    }
    return await getEntry(entry.id);
  } catch (error) {
    const { error: cleanupError } = await admin
      .from("entries")
      .delete()
      .eq("id", entry.id)
      .eq("user_id", userId);
    if (cleanupError) throw cleanupError;
    throw error;
  }
}

// Dashboard queries are independent of the legacy latest-100 list.
export async function getEntrySummary(
  userId: string,
  scope: import("@/lib/entry-types").OwnerScope,
): Promise<import("@/lib/entry-types").EntrySummary> {
  const count = async (kind: Entry["kind"], mapped = false) => {
    let query = createAdminClient()
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("kind", kind);
    if (scope === "mine") query = query.eq("user_id", userId);
    if (mapped) query = query.not("lat", "is", null).not("lng", "is", null);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  };
  const [placeCount, itemCount, mappedPlaceCount, mappedItemCount] =
    await Promise.all([
      count("place"),
      count("item"),
      count("place", true),
      count("item", true),
    ]);
  return { scope, placeCount, itemCount, mappedPlaceCount, mappedItemCount };
}
export async function listEntryPage(
  userId: string,
  filter: import("@/lib/validations/entry-query").EntryQuery,
): Promise<import("@/lib/entry-types").EntryPage> {
  let query = createAdminClient()
    .from("entries")
    .select(entrySelect, { count: "exact" });
  if (filter.scope === "mine") query = query.eq("user_id", userId);
  if (filter.kind) query = query.eq("kind", filter.kind);
  if (filter.q)
    query = query.ilike("name", `%${filter.q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(
      (filter.page - 1) * filter.pageSize,
      filter.page * filter.pageSize - 1,
    );
  if (error) throw error;
  return {
    entries: await attachPhotos(
      (data as unknown as RawEntry[]).map(hydrateEntry),
    ),
    total: count ?? 0,
    page: filter.page,
    pageSize: filter.pageSize,
  };
}
export async function listMapPoints(
  userId: string,
  filter: ReturnType<
    typeof import("@/lib/validations/entry-query").parseMapQuery
  >,
): Promise<import("@/lib/entry-types").MapPage> {
  let query = createAdminClient()
    .from("entries")
    .select("id,kind,name,rating,lat,lng,address_text,created_at")
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (filter.scope === "mine") query = query.eq("user_id", userId);
  if (filter.kind !== "all") query = query.eq("kind", filter.kind);
  if (filter.after) {
    const { created_at, id } = filter.after;
    query = query.or(
      `created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`,
    );
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(501);
  if (error) throw error;
  const points = (data ?? []) as import("@/lib/entry-types").MapPoint[];
  const hasMore = points.length > 500;
  const page = await attachCoverUrls(points.slice(0, 500));
  const last = page.at(-1);
  return {
    points: page,
    hasMore,
    nextCursor:
      hasMore && last
        ? Buffer.from(
            JSON.stringify({ created_at: last.created_at, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
