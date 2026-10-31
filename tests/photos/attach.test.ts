import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  queries: [] as { table: string; ops: [string, ...unknown[]][] }[],
  results: [] as unknown[],
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const query = { table, ops: [] as [string, ...unknown[]][] };
      db.queries.push(query);
      const result = db.results.shift() ?? { data: [], error: null };
      const builder: Record<string, unknown> = {
        then: (resolve: (v: unknown) => void) =>
          Promise.resolve(result).then(resolve),
      };
      for (const op of [
        "select",
        "eq",
        "not",
        "in",
        "order",
        "limit",
        "maybeSingle",
      ]) {
        builder[op] = (...args: unknown[]) => {
          query.ops.push([op, ...args]);
          return builder;
        };
      }
      return builder;
    },
  }),
}));

import { attachCoverUrls, attachPhotos, type Entry } from "@/lib/entries";

const base = {
  user_id: "u",
  kind: "place" as const,
  name: "面馆",
  note: null,
  rating: 4,
  lat: 31,
  lng: 121,
  address_text: null,
  created_at: "",
  cuisines: [],
  categories: [],
  tags: [],
};

beforeEach(() => {
  db.queries = [];
  db.results = [];
});

it("skips the photo query when there are no entries", async () => {
  expect(await attachPhotos([])).toEqual([]);
  expect(db.queries).toEqual([]);
});

it("attaches cover urls and optional full photo lists", async () => {
  const photos = [
    {
      id: "p0",
      entry_id: "a",
      user_id: "u",
      r2_key: "k0",
      public_url: "https://cdn.example/a.webp",
      sort: 0,
      width: null,
      height: null,
      bytes: null,
      content_type: "image/webp",
      created_at: "",
    },
    {
      id: "p1",
      entry_id: "b",
      user_id: "u",
      r2_key: "k1",
      public_url: "https://cdn.example/b.webp",
      sort: 1,
      width: null,
      height: null,
      bytes: null,
      content_type: "image/webp",
      created_at: "",
    },
  ];
  db.results.push({ data: photos, error: null });
  const entries: Entry[] = [
    { ...base, id: "a" },
    { ...base, id: "b" },
  ];
  const [first, second] = await attachPhotos(entries, { full: true });
  expect(first?.cover_photo_url).toBe("https://cdn.example/a.webp");
  expect(first?.photos).toHaveLength(1);
  expect(second?.cover_photo_url).toBe("https://cdn.example/b.webp");
  expect(db.queries[0]?.ops).toContainEqual(["in", "entry_id", ["a", "b"]]);
});

it("adds cover_photo_url to map points", async () => {
  db.results.push({
    data: [
      {
        id: "p0",
        entry_id: "a",
        public_url: "https://cdn.example/a.webp",
        sort: 0,
      },
    ],
    error: null,
  });
  const [point] = await attachCoverUrls([{ id: "a", name: "面馆" }]);
  expect(point).toEqual({
    id: "a",
    name: "面馆",
    cover_photo_url: "https://cdn.example/a.webp",
  });
});
