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

it("chunks photo lookups so map pages do not overflow the filter URL", async () => {
  const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
  db.results.push(
    { data: [], error: null },
    { data: [], error: null },
    { data: [], error: null },
  );
  await attachCoverUrls(ids.map((id) => ({ id })));
  expect(db.queries).toHaveLength(3);
  const chunkSizes = db.queries.map((query) => {
    const op = query.ops.find((item) => item[0] === "in");
    return Array.isArray(op?.[2]) ? op[2].length : 0;
  });
  expect(chunkSizes).toEqual([100, 100, 50]);
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

it("keeps cover mode free of photos and strips keys in thin mode", async () => {
  const photos = [
    {
      id: "p1",
      entry_id: "a",
      user_id: "u",
      r2_key: "secret/key",
      public_url: "https://cdn.example/one.webp",
      sort: 1,
      width: null,
      height: null,
      bytes: null,
      content_type: "image/webp",
      created_at: "",
    },
    {
      id: "p0",
      entry_id: "a",
      user_id: "u",
      r2_key: "secret/cover",
      public_url: "https://cdn.example/cover.webp",
      sort: 0,
      width: null,
      height: null,
      bytes: null,
      content_type: "image/webp",
      created_at: "",
    },
  ];
  db.results.push({ data: photos, error: null });
  const [coverOnly] = await attachPhotos<Entry>([{ ...base, id: "a" }]);
  expect(coverOnly?.cover_photo_url).toBe("https://cdn.example/cover.webp");
  expect(coverOnly?.photos).toBeUndefined();

  db.results.push({ data: photos, error: null });
  const [thin] = await attachPhotos<Entry>([{ ...base, id: "a" }], {
    mode: "thin",
  });
  expect(thin?.cover_photo_url).toBe("https://cdn.example/cover.webp");
  expect(thin?.photos).toEqual([
    { id: "p0", public_url: "https://cdn.example/cover.webp", sort: 0 },
    { id: "p1", public_url: "https://cdn.example/one.webp", sort: 1 },
  ]);
  expect(thin?.photos?.some((photo) => "r2_key" in photo && photo.r2_key)).toBe(
    false,
  );
});

it("uses the first sorted photo as cover when sort 0 is missing", async () => {
  db.results.push({
    data: [
      {
        id: "p2",
        entry_id: "a",
        user_id: "u",
        r2_key: "k2",
        public_url: "https://cdn.example/two.webp",
        sort: 2,
        width: null,
        height: null,
        bytes: null,
        content_type: "image/webp",
        created_at: "",
      },
      {
        id: "p1",
        entry_id: "a",
        user_id: "u",
        r2_key: "k1",
        public_url: "https://cdn.example/one.webp",
        sort: 1,
        width: null,
        height: null,
        bytes: null,
        content_type: "image/webp",
        created_at: "",
      },
    ],
    error: null,
  });
  const [entry] = await attachPhotos<Entry>([{ ...base, id: "a" }], {
    mode: "thin",
  });
  expect(entry?.cover_photo_url).toBe("https://cdn.example/one.webp");
  expect(entry?.photos?.map((photo) => photo.id)).toEqual(["p1", "p2"]);
});
