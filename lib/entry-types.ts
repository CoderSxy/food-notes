import type { Entry } from "@/lib/entries";
export type OwnerScope = "mine" | "all";
export type MapKind = "all" | "place" | "item";
export type EntrySummary = {
  scope: OwnerScope;
  placeCount: number;
  itemCount: number;
  mappedPlaceCount: number;
  mappedItemCount: number;
};
export type MapPoint = Pick<
  Entry,
  "id" | "kind" | "name" | "rating" | "address_text" | "created_at"
> & { lat: number; lng: number };
export type MapPage = {
  points: MapPoint[];
  nextCursor: string | null;
  hasMore: boolean;
};
export type EntryPage = {
  entries: Entry[];
  total: number;
  page: number;
  pageSize: number;
};
