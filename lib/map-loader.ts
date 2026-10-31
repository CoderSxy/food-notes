import type { MapPage } from "./entry-types";
export async function loadMapPages(
  fetchPage: (cursor: string | null) => Promise<MapPage>,
  publish: (page: MapPage) => void,
  signal: AbortSignal,
  start: string | null = null,
) {
  let cursor = start;
  const seen = new Set<string>();
  while (!signal.aborted) {
    const page = await fetchPage(cursor);
    if (signal.aborted) return;
    if (page.hasMore && (!page.nextCursor || seen.has(page.nextCursor)))
      throw new Error("地图分页异常，请刷新重试");
    publish(page);
    if (!page.hasMore) return;
    cursor = page.nextCursor;
    seen.add(cursor!);
  }
}
