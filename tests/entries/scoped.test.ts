import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  queries: [] as { ops: unknown[][] }[],
  results: [] as unknown[],
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const query = { ops: [] as unknown[][] };
      db.queries.push(query);
      const result = db.results.shift() ?? { data: [], count: 0, error: null };
      const builder: Record<string, unknown> = {
        then: (resolve: (x: unknown) => void) =>
          Promise.resolve(result).then(resolve),
      };
      for (const op of [
        "select",
        "eq",
        "not",
        "in",
        "order",
        "limit",
        "range",
        "or",
        "ilike",
      ])
        builder[op] = (...args: unknown[]) => {
          query.ops.push([op, ...args]);
          return builder;
        };
      return builder;
    },
  }),
}));
import { getEntrySummary, listEntryPage, listMapPoints } from "@/lib/entries";
import { parseEntryQuery, parseMapQuery } from "@/lib/validations/entry-query";
beforeEach(() => {
  db.queries = [];
  db.results = [];
});
it("defaults to mine and validates pagination, scope and cursors", () => {
  expect(parseEntryQuery(new URLSearchParams())).toMatchObject({
    scope: "mine",
    page: 1,
    pageSize: 20,
  });
  for (const query of ["scope=other", "page=-1", "pageSize=101", "kind=other"])
    expect(() => parseEntryQuery(new URLSearchParams(query))).toThrow();
  expect(() =>
    parseMapQuery(new URLSearchParams("cursor=not-a-cursor")),
  ).toThrow();
});
it("counts independently of pages and filters every mine count on the server", async () => {
  db.results = [
    { count: 140, error: null },
    { count: 80, error: null },
    { count: 140, error: null },
    { count: 60, error: null },
  ];
  expect(await getEntrySummary("me", "mine")).toEqual({
    scope: "mine",
    placeCount: 140,
    itemCount: 80,
    mappedPlaceCount: 140,
    mappedItemCount: 60,
  });
  for (const query of db.queries) {
    expect(query.ops).toContainEqual(["eq", "user_id", "me"]);
    expect(query.ops).toContainEqual([
      "select",
      "id",
      { count: "exact", head: true },
    ]);
    expect(query.ops.some((x) => x[0] === "limit")).toBe(false);
  }
});
it("paginates after filtering and escapes literal wildcard search", async () => {
  db.results = [{ data: [], count: 41, error: null }];
  const result = await listEntryPage(
    "me",
    parseEntryQuery(new URLSearchParams("page=2&q=50%25_&kind=item")),
  );
  expect(result).toMatchObject({
    total: 41,
    page: 2,
    pageSize: 20,
    entries: [],
  });
  expect(db.queries[0].ops).toContainEqual(["eq", "user_id", "me"]);
  expect(db.queries[0].ops).toContainEqual(["range", 20, 39]);
  expect(db.queries[0].ops).toContainEqual(["ilike", "name", "%50\\%\\_%"]);
});
it("loads map pages of 500 and makes a stable cursor for equal dates", async () => {
  const points = Array.from({ length: 501 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(9999 - i).padStart(12, "0")}`,
    created_at: "2026-10-31T00:00:00.000Z",
    lat: 0,
    lng: 0,
  }));
  db.results = [{ data: points, error: null }];
  const first = await listMapPoints(
    "me",
    parseMapQuery(new URLSearchParams("scope=all")),
  );
  expect(first.points).toHaveLength(500);
  expect(first.hasMore).toBe(true);
  expect(first.nextCursor).toBeTruthy();
  expect(db.queries[0].ops).not.toContainEqual(["eq", "user_id", "me"]);
  db.results = [{ data: [points[500]], error: null }];
  const second = await listMapPoints(
    "me",
    parseMapQuery(new URLSearchParams({ cursor: first.nextCursor! })),
  );
  expect(second.points).toEqual([
    { ...points[500], cover_photo_url: null },
  ]);
  expect(second.hasMore).toBe(false);
  expect(
    db.queries.some((query) =>
      query.ops.some(
        (x) => x[0] === "or" && String(x[1]).includes(points[499].id),
      ),
    ),
  ).toBe(true);
});
