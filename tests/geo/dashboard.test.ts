import { expect, it } from "vitest";
import { clusterPoints } from "@/lib/geo/clusters";
import { loadMapPages } from "@/lib/map-loader";
import type { MapPoint } from "@/lib/entry-types";
const point = (id: string): MapPoint => ({
  id,
  kind: "place",
  name: id,
  rating: 4,
  lat: 0,
  lng: 0,
  address_text: null,
  created_at: "2026-10-31T00:00:00Z",
});
it("clusters coincident entries without losing individually selectable records", () => {
  const groups = clusterPoints([point("a"), point("b")], () => ({
    x: 100,
    y: 100,
  }));
  expect(groups).toHaveLength(1);
  expect(groups[0].points.map((p) => p.id)).toEqual(["a", "b"]);
});
it("collects every page beyond 100 and yields a resume cursor before proceeding", async () => {
  const published: string[][] = [];
  let count = 0;
  await loadMapPages(
    async (cursor) => {
      count++;
      return cursor
        ? { points: [point("last")], nextCursor: null, hasMore: false }
        : {
            points: Array.from({ length: 500 }, (_, i) => point(String(i))),
            nextCursor: "second",
            hasMore: true,
          };
    },
    (page) => published.push(page.points.map((p) => p.id)),
    new AbortController().signal,
  );
  expect(count).toBe(2);
  expect(published[0]).toHaveLength(500);
  expect(published[1]).toEqual(["last"]);
});
it("never publishes a late page after the range is cancelled", async () => {
  const controller = new AbortController();
  let published = false;
  await loadMapPages(
    async () => {
      controller.abort();
      return { points: [point("a")], nextCursor: null, hasMore: false };
    },
    () => {
      published = true;
    },
    controller.signal,
  );
  expect(published).toBe(false);
});
it("rejects repeating cursors instead of looping forever", async () => {
  await expect(
    loadMapPages(
      async () => ({ points: [], nextCursor: "same", hasMore: true }),
      () => {},
      new AbortController().signal,
    ),
  ).rejects.toThrow("地图分页异常");
});
