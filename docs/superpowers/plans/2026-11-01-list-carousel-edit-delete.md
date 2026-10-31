# List carousel + own edit/delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable mobile pinch-zoom; list covers become manual scroll-snap carousels with dots; owners get Edit/Delete on list cards with `/entries/[id]/edit` + PUT update (kind locked).

**Architecture:** Extend `attachPhotos` with thin mode for list photos; new `EntryCoverCarousel`; EntryCard actions via useAuth; EntryForm create|edit modes; PUT + `updateEntry` owner-only.

**Tech Stack:** Next.js 15 App Router, React client components, CSS scroll-snap (no carousel libs), Zod entryCreateSchema reuse, Vitest, existing photo APIs.

## Global Constraints

- Chinese UI copy; warm 食记 styles in globals.css
- No Swiper/embla; no kind change on edit; no photo reorder/set-cover API; no map changes; no migrations/env
- Spec: `docs/superpowers/specs/2026-11-01-list-carousel-edit-delete-design.md` (already on this branch) — implement exactly that, not invent scope

---

## File map

Locked from spec §6–7. Do not add files outside this list. Do not modify map components, `/api/foods/*`, migrations, or `package.json` dependencies.

### Create

| Path | Responsibility |
| --- | --- |
| `components/EntryCoverCarousel.tsx` | Client carousel: `photos: EntryPhotoThumb[]`, CSS snap track, dots when `length > 1`, no timer |
| `app/entries/[id]/edit/page.tsx` | Edit route: GET entry + `/api/auth/me`, non-owner message, render `EntryForm mode="edit"` |
| `tests/layout/viewport.test.ts` | Assert root `viewport` export values via source (avoid importing `app/layout.tsx` CSS) |
| `tests/components/entry-cover-carousel.test.ts` | 0 / 1 / 2+ slides, no timer, dots, title link unchanged on card |
| `tests/components/entry-card-actions.test.ts` | Owner 编辑/删除, confirm cancel, DELETE + `onDeleted` |
| `tests/components/entry-form-edit.test.ts` | Edit prefill, locked kind, PUT, redirect via `safeNext(from)` |
| `tests/components/entries-list-delete.test.ts` | `nextListAfterDelete` local remove + empty page > 1 |
| `tests/layout/app-dock-edit.test.ts` | `/entries/{id}/edit` highlights 记录, not 增加 |

### Modify

| Path | Responsibility |
| --- | --- |
| `app/layout.tsx` | Export `viewport` (`maximumScale: 1`, `userScalable: false`, device-width defaults) + iOS a11y comment |
| `lib/photo-constants.ts` | Add `export type EntryPhotoThumb = Pick<EntryPhoto, "id" \| "public_url" \| "sort">` |
| `lib/entries.ts` | `Entry.photos?: EntryPhotoThumb[]`; `attachPhotos` `mode: "cover" \| "thin" \| "full"` + legacy `{ full: true }`; `listEntryPage` / `nearbyPlaceEntries` / `listEntries` use `thin`; add `updateEntry` |
| `lib/validations/entry.ts` | `export type EntryUpdate = EntryCreate` |
| `components/EntryCard.tsx` | Cover → `EntryCoverCarousel`; `useAuth()`; owner 编辑/删除; `onDeleted?: (id: string) => void` |
| `app/globals.css` | Cover track / slides / dots / `.entry-card-actions`; keep 16:9 |
| `app/entries/page.tsx` | Export `nextListAfterDelete`; pass `onDeleted`; empty page > 1 uses existing `change({ page })` |
| `app/api/entries/[id]/route.ts` | Add `PUT` (owner-only, kind lock, `updateEntry`) |
| `components/EntryForm.tsx` | `mode?: "create" \| "edit"`, `entry?: Entry`; edit: prefill, lock kind, `EntryPhotos`, PUT, return to list |
| `components/EntryPhotos.tsx` | Widen `photos` / `onChange` to `EntryPhotoThumb[]` so edit can pass GET or thin objects |
| `app/entries/[id]/page.tsx` | Owner 「编辑」link beside delete |
| `tests/photos/attach.test.ts` | thin / cover / `{ full: true }` / missing sort 0 |
| `tests/api/entries.test.ts` | PUT 401/403/404/400 kind / 200 updateEntry |
| `tests/entries/data.test.ts` | `updateEntry` field replace + associations; mock `update` |
| `tests/validations/entry.test.ts` | `EntryUpdate` is `EntryCreate`; create rules unchanged |
| `tests/components/rating-display.test.ts` | Still finds `.entry-cover img` for `cover_photo_url` fallback |
| `tests/components/entry-detail.test.ts` | Owner sees 编辑 href |

### Do not touch

`components/map/*`, `lib/entry-types.ts` MapPoint (cover only), `attachCoverUrls` / `listMapPoints`, `package.json` deps, `supabase/migrations/*`, `.env*`, `app/api/foods/*`, `components/FoodCard.tsx`, `components/PhotoPicker.tsx` create-time 设为封面.

---

### Task 1: Root viewport lock

**Files:**
- Modify: `app/layout.tsx`
- Test: `tests/layout/viewport.test.ts`

**Interfaces:**
- Consumes: Next.js 15 `Viewport` from `"next"`
- Produces: `export const viewport: Viewport` with `width: "device-width"`, `initialScale: 1`, `maximumScale: 1`, `userScalable: false`

- [ ] **Step 1: Write the failing test**

Create `tests/layout/viewport.test.ts`. Do not `import` `app/layout.tsx` (it pulls `leaflet.css` + `AppShell`). Read the source like `tests/components/system-fonts.test.ts`.

```ts
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("exports a Next.js viewport that disables mobile pinch-zoom", () => {
  const source = readFileSync("app/layout.tsx", "utf8");
  expect(source).toContain('import type { Metadata, Viewport } from "next"');
  expect(source).toContain("export const viewport");
  expect(source).toContain('width: "device-width"');
  expect(source).toMatch(/initialScale:\s*1/);
  expect(source).toMatch(/maximumScale:\s*1/);
  expect(source).toMatch(/userScalable:\s*false/);
  expect(source).not.toContain('<meta name="viewport"');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/layout/viewport.test.ts
```

Expected: FAIL — source has `import type { Metadata }` only, no `viewport`.

- [ ] **Step 3: Write minimal implementation**

Replace the top of `app/layout.tsx` with:

```ts
import type { Metadata, Viewport } from "next";
import AppShell from "@/components/layout/AppShell";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "美食地图",
  description: "记下好味道，发现身边的美食",
};

// iOS Safari: userScalable/maximumScale block pinch-zoom for low-vision users.
// Product still wants no mobile web zoom; desktop Ctrl+wheel is unchanged.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
```

Leave `RootLayout` unchanged. Do not add a raw `<meta name="viewport">`.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/layout/viewport.test.ts tests/components/system-fonts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx tests/layout/viewport.test.ts
git commit -m "feat: lock mobile viewport scale on the root layout"
```

---

### Task 2: Thin list photos on `attachPhotos`

**Files:**
- Modify: `lib/photo-constants.ts`
- Modify: `lib/entries.ts` (`Entry.photos`, `attachPhotos`, `listEntries`, `nearbyPlaceEntries`, `listEntryPage`)
- Test: `tests/photos/attach.test.ts`

**Interfaces:**
- Consumes: `EntryPhoto`, `coverUrlFromPhotos`, `listPhotosForEntries`
- Produces:
  - `export type EntryPhotoThumb = Pick<EntryPhoto, "id" | "public_url" | "sort">`
  - `export type AttachPhotosOpts = { mode?: "cover" | "thin" | "full"; full?: boolean }`
  - `export async function attachPhotos<T extends Entry>(entries: T[], opts?: AttachPhotosOpts): Promise<T[]>`
  - `resolveAttachMode(opts)`: `{ full: true }` ⇒ `"full"`; else `opts.mode ?? "cover"`
  - `listEntryPage` / `nearbyPlaceEntries` / `listEntries` call `attachPhotos(..., { mode: "thin" })`
  - `getEntry` still `attachPhotos(..., { full: true })`
  - `attachCoverUrls` / `listMapPoints` unchanged

- [ ] **Step 1: Write the failing tests**

Append to `tests/photos/attach.test.ts` (keep existing cases). Add imports for `EntryPhotoThumb` after the type exists — write the assertions first so they fail:

```ts
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
  const [coverOnly] = await attachPhotos([{ ...base, id: "a" }]);
  expect(coverOnly?.cover_photo_url).toBe("https://cdn.example/cover.webp");
  expect(coverOnly?.photos).toBeUndefined();

  db.results.push({ data: photos, error: null });
  const [thin] = await attachPhotos([{ ...base, id: "a" }], { mode: "thin" });
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
  const [entry] = await attachPhotos([{ ...base, id: "a" }], { mode: "thin" });
  expect(entry?.cover_photo_url).toBe("https://cdn.example/one.webp");
  expect(entry?.photos?.map((photo) => photo.id)).toEqual(["p1", "p2"]);
});
```

Keep the existing `{ full: true }` test as-is so the alias must keep working.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/photos/attach.test.ts
```

Expected: FAIL — `mode: "thin"` is ignored; `photos` missing or still contain `r2_key`.

- [ ] **Step 3: Write minimal implementation**

In `lib/photo-constants.ts` after `EntryPhoto`:

```ts
export type EntryPhotoThumb = Pick<EntryPhoto, "id" | "public_url" | "sort">;
```

In `lib/entries.ts`:

```ts
import {
  coverUrlFromPhotos,
  listPhotosForEntries,
  type EntryPhoto,
} from "@/lib/photos";
import type { EntryPhotoThumb } from "@/lib/photo-constants";

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
  photos?: EntryPhotoThumb[];
};

export type AttachPhotosOpts = {
  mode?: "cover" | "thin" | "full";
  full?: boolean;
};

export function resolveAttachMode(
  opts?: AttachPhotosOpts,
): "cover" | "thin" | "full" {
  if (opts?.mode) return opts.mode;
  if (opts?.full) return "full";
  return "cover";
}

function asThumbs(photos: EntryPhoto[]): EntryPhotoThumb[] {
  return [...photos]
    .sort((a, b) => a.sort - b.sort)
    .map(({ id, public_url, sort }) => ({ id, public_url, sort }));
}

export async function attachPhotos<T extends Entry>(
  entries: T[],
  opts?: AttachPhotosOpts,
): Promise<T[]> {
  if (!entries.length) return entries;
  const mode = resolveAttachMode(opts);
  const grouped = groupPhotos(
    await listPhotosForEntries(entries.map((entry) => entry.id)),
  );
  return entries.map((entry) => {
    const photos = [...(grouped.get(entry.id) ?? [])].sort(
      (a, b) => a.sort - b.sort,
    );
    const cover_photo_url = coverUrlFromPhotos(photos);
    if (mode === "cover") return { ...entry, cover_photo_url };
    if (mode === "thin")
      return { ...entry, cover_photo_url, photos: asThumbs(photos) };
    return { ...entry, cover_photo_url, photos };
  });
}
```

Change the three list call sites only:

```ts
return attachPhotos((data as unknown as RawEntry[]).map(hydrateEntry), {
  mode: "thin",
});
```

in `listEntries` and `listEntryPage`.

```ts
return attachPhotos(nearby, { mode: "thin" });
```

in `nearbyPlaceEntries`.

Leave `getEntry` as `attachPhotos([hydrateEntry(...)], { full: true })`.
Leave `attachCoverUrls` / `listMapPoints` alone.

Re-export the thumb type from entries if convenient:

```ts
export type { EntryPhotoThumb } from "@/lib/photo-constants";
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/photos/attach.test.ts tests/photos/key.test.ts tests/entries/scoped.test.ts tests/geo/dashboard.test.ts
```

Expected: PASS. Map tests still only see `cover_photo_url`.

- [ ] **Step 5: Commit**

```bash
git add lib/photo-constants.ts lib/entries.ts tests/photos/attach.test.ts
git commit -m "feat: attach thin photo lists for entry cards"
```

---

### Task 3: Manual cover carousel

**Files:**
- Create: `components/EntryCoverCarousel.tsx`
- Modify: `components/EntryCard.tsx`
- Modify: `app/globals.css` (`.entry-cover` block near line 1234; keep `.entry-cover img` object-fit)
- Test: `tests/components/entry-cover-carousel.test.ts`
- Test: `tests/components/rating-display.test.ts` (must stay green)

**Interfaces:**
- Consumes: `EntryPhotoThumb` from `@/lib/photo-constants`
- Produces:
  - `export default function EntryCoverCarousel(props: { photos: EntryPhotoThumb[] }): JSX.Element | null`
  - `export function slidesForEntry(entry: Pick<Entry, "photos" | "cover_photo_url">): EntryPhotoThumb[]` — `photos` sorted by `sort`, else a single synthetic `{ id: "cover", public_url: cover_photo_url, sort: 0 }` when only the legacy cover exists, else `[]`
  - `EntryCard` renders `<EntryCoverCarousel photos={slidesForEntry(entry)} />` and does not wrap the cover in `Link`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/entry-cover-carousel.test.ts`:

```ts
// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import EntryCoverCarousel from "@/components/EntryCoverCarousel";
import EntryCard, { slidesForEntry } from "@/components/EntryCard";
import type { Entry } from "@/lib/entries";

afterEach(cleanup);

const photos = [
  { id: "p0", public_url: "https://cdn.example/a.webp", sort: 0 },
  { id: "p1", public_url: "https://cdn.example/b.webp", sort: 1 },
];

const entry: Entry = {
  id: "e1",
  user_id: "u",
  kind: "place",
  name: "面馆",
  note: "味道好",
  rating: 4,
  lat: 31,
  lng: 121,
  address_text: null,
  created_at: "2026-11-01T00:00:00Z",
  cuisines: [],
  categories: [],
  tags: [],
  photos,
  cover_photo_url: "https://cdn.example/a.webp",
};

it("renders nothing without photos", () => {
  const { container } = render(createElement(EntryCoverCarousel, { photos: [] }));
  expect(container).toBeEmptyDOMElement();
});

it("shows one image and no dots for a single photo", () => {
  const { container } = render(
    createElement(EntryCoverCarousel, { photos: [photos[0]] }),
  );
  expect(container.querySelectorAll(".entry-cover-slide")).toHaveLength(1);
  expect(container.querySelector(".entry-cover-dots")).toBeNull();
  expect(screen.getByAltText("封面照片").getAttribute("src")).toBe(
    "https://cdn.example/a.webp",
  );
});

it("shows dots for multiple photos and has no autoplay timer", () => {
  const spy = vi.spyOn(globalThis, "setInterval");
  const { container } = render(createElement(EntryCoverCarousel, { photos }));
  expect(container.querySelectorAll(".entry-cover-dot")).toHaveLength(2);
  expect(
    container.querySelectorAll('.entry-cover-dot[aria-current="true"]'),
  ).toHaveLength(1);
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

it("scrolls the track when a dot is clicked", () => {
  const { container } = render(createElement(EntryCoverCarousel, { photos }));
  const track = container.querySelector(".entry-cover-track") as HTMLDivElement;
  Object.defineProperty(track, "clientWidth", { value: 300, configurable: true });
  track.scrollTo = vi.fn();
  fireEvent.click(screen.getByRole("button", { name: "第 2 张" }));
  expect(track.scrollTo).toHaveBeenCalledWith({ left: 300, behavior: "smooth" });
});

it("keeps the title as the only detail link and never links the cover", () => {
  const { container } = render(
    createElement(EntryCard, {
      entry,
      source: "/entries?scope=mine",
    }),
  );
  expect(container.querySelector(".entry-cover a")).toBeNull();
  expect(screen.getByRole("link", { name: "面馆" }).getAttribute("href")).toBe(
    "/entries/e1?from=%2Fentries%3Fscope%3Dmine",
  );
});

describe("slidesForEntry", () => {
  it("prefers sorted photos and falls back to cover_photo_url", () => {
    expect(slidesForEntry({ photos, cover_photo_url: "x" }).map((p) => p.id)).toEqual([
      "p0",
      "p1",
    ]);
    expect(
      slidesForEntry({
        photos: [],
        cover_photo_url: "https://cdn.example/cover.webp",
      }),
    ).toEqual([
      { id: "cover", public_url: "https://cdn.example/cover.webp", sort: 0 },
    ]);
    expect(slidesForEntry({ photos: [], cover_photo_url: null })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/entry-cover-carousel.test.ts tests/components/rating-display.test.ts
```

Expected: FAIL — `EntryCoverCarousel` / `slidesForEntry` not found.

- [ ] **Step 3: Write minimal implementation**

`components/EntryCoverCarousel.tsx`:

```tsx
"use client";
import { useRef, useState } from "react";
import type { EntryPhotoThumb } from "@/lib/photo-constants";

export default function EntryCoverCarousel({
  photos,
}: {
  photos: EntryPhotoThumb[];
}) {
  const sorted = [...photos].sort((a, b) => a.sort - b.sort);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (!sorted.length) return null;

  function onScroll() {
    const el = track.current;
    if (!el?.clientWidth) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function go(next: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="entry-cover" role="region" aria-label="照片">
      <div
        className="entry-cover-track"
        ref={track}
        onScroll={onScroll}
      >
        {sorted.map((photo, i) => (
          <div className="entry-cover-slide" key={photo.id}>
            <img src={photo.public_url} alt={i === 0 ? "封面照片" : ""} />
          </div>
        ))}
      </div>
      {sorted.length > 1 && (
        <div className="entry-cover-dots">
          {sorted.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              className="entry-cover-dot"
              aria-label={`第 ${i + 1} 张`}
              aria-current={i === index}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Add to `components/EntryCard.tsx`:

```tsx
import EntryCoverCarousel from "@/components/EntryCoverCarousel";
import type { Entry } from "@/lib/entries";
import type { EntryPhotoThumb } from "@/lib/photo-constants";

export function slidesForEntry(
  entry: Pick<Entry, "photos" | "cover_photo_url">,
): EntryPhotoThumb[] {
  if (entry.photos?.length)
    return [...entry.photos].sort((a, b) => a.sort - b.sort);
  if (entry.cover_photo_url)
    return [{ id: "cover", public_url: entry.cover_photo_url, sort: 0 }];
  return [];
}
```

Replace the cover block:

```tsx
<EntryCoverCarousel photos={slidesForEntry(entry)} />
```

Do not wrap that node in `Link`. Keep the title `Link` exactly as it is.

In `app/globals.css` replace `.entry-cover` (keep the shared `img` object-fit rule) and add:

```css
.entry-cover {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  margin: 0 0 14px;
  aspect-ratio: 16 / 9;
  background: var(--stamp);
}
.entry-cover-track {
  display: flex;
  height: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  scrollbar-width: none;
}
.entry-cover-track::-webkit-scrollbar {
  display: none;
}
.entry-cover-slide {
  flex: 0 0 100%;
  min-width: 100%;
  height: 100%;
  scroll-snap-align: start;
}
.entry-cover-dots {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 8px;
  display: flex;
  justify-content: center;
  gap: 6px;
}
.entry-cover-dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
}
.entry-cover-dot[aria-current="true"] {
  background: var(--terracotta);
}
```

No `setInterval`. No Swiper/embla import.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/entry-cover-carousel.test.ts tests/components/rating-display.test.ts
```

Expected: PASS. Rating test still finds `.entry-cover img` via the `cover_photo_url` fallback.

- [ ] **Step 5: Commit**

```bash
git add components/EntryCoverCarousel.tsx components/EntryCard.tsx app/globals.css tests/components/entry-cover-carousel.test.ts
git commit -m "feat: swipe list covers with scroll-snap dots"
```

---

### Task 4: Owner edit/delete on list cards

**Files:**
- Modify: `components/EntryCard.tsx`
- Modify: `app/entries/page.tsx`
- Modify: `app/globals.css` (`.entry-card-actions`)
- Test: `tests/components/entry-card-actions.test.ts`
- Test: `tests/components/entries-list-delete.test.ts`

**Interfaces:**
- Consumes: `useAuth()` from `@/lib/auth/context` (`user.userId`); `requestJson`; existing `DELETE /api/entries/:id`; `slidesForEntry` from Task 3
- Produces:
  - `EntryCard` props: `{ entry: Entry; source?: string; onDeleted?: (id: string) => void }`
  - Owner-only links/buttons: 编辑 → `/entries/{id}/edit?from={encodeURIComponent(source)}`; 删除 → `window.confirm("确定删除这条记录吗？")` then DELETE
  - `export function nextListAfterDelete(data: EntryPage, id: string, page: number): { data: EntryPage; bumpPage: number | null }`
  - List `onDeleted` applies that helper; if `bumpPage !== null` call existing `change({ page: String(bumpPage) })`

- [ ] **Step 1: Write the failing tests**

`tests/components/entry-card-actions.test.ts`:

```ts
// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const auth = vi.hoisted(() => ({ userId: "owner" as string | undefined }));
vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    user: auth.userId ? { userId: auth.userId } : null,
    status: auth.userId ? "signed-in" : "signed-out",
    error: "",
    retry: async () => {},
    login: async () => {},
    logout: async () => {},
  }),
}));

import EntryCard from "@/components/EntryCard";
import type { Entry } from "@/lib/entries";

afterEach(() => {
  cleanup();
  auth.userId = "owner";
  vi.unstubAllGlobals();
});

const entry: Entry = {
  id: "e1",
  user_id: "owner",
  kind: "place",
  name: "面馆",
  note: null,
  rating: 4,
  lat: 31,
  lng: 121,
  address_text: null,
  created_at: "2026-11-01T00:00:00Z",
  cuisines: [],
  categories: [],
  tags: [],
};

it("shows edit and delete only for the owner", () => {
  const { rerender } = render(
    createElement(EntryCard, { entry, source: "/entries?scope=all" }),
  );
  expect(screen.getByRole("link", { name: "编辑" }).getAttribute("href")).toBe(
    "/entries/e1/edit?from=%2Fentries%3Fscope%3Dall",
  );
  expect(screen.getByRole("button", { name: "删除" })).toBeTruthy();

  auth.userId = "other";
  rerender(createElement(EntryCard, { entry, source: "/entries?scope=all" }));
  expect(screen.queryByRole("link", { name: "编辑" })).toBeNull();
  expect(screen.queryByRole("button", { name: "删除" })).toBeNull();
});

it("does not delete when the confirm is cancelled", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("confirm", () => false);
  const onDeleted = vi.fn();
  render(createElement(EntryCard, { entry, onDeleted }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(onDeleted).not.toHaveBeenCalled();
});

it("deletes after confirm and notifies the list", async () => {
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    expect(String(url)).toBe("/api/entries/e1");
    expect(init?.method).toBe("DELETE");
    return Response.json({ ok: true });
  });
  const onDeleted = vi.fn();
  render(createElement(EntryCard, { entry, onDeleted }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(await screen.findByRole("button", { name: "正在删除…" })).toBeTruthy();
  await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith("e1"));
});

it("keeps the card and shows the API error when delete fails", async () => {
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal("fetch", async () =>
    Response.json({ error: "只能删除自己的记录" }, { status: 403 }),
  );
  const onDeleted = vi.fn();
  render(createElement(EntryCard, { entry, onDeleted }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "只能删除自己的记录",
  );
  expect(onDeleted).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "删除" })).toBeTruthy();
});
```

`tests/components/entries-list-delete.test.ts`:

```ts
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("scope=mine"),
}));
import { nextListAfterDelete } from "@/app/entries/page";
import type { Entry } from "@/lib/entries";
import type { EntryPage } from "@/lib/entry-types";

const card = (id: string): Entry => ({
  id,
  user_id: "u",
  kind: "item",
  name: id,
  note: null,
  rating: 4,
  lat: null,
  lng: null,
  address_text: null,
  created_at: "",
  cuisines: [],
  categories: [],
  tags: [],
});

const page = (ids: string[], total: number): EntryPage => ({
  entries: ids.map(card),
  total,
  page: 1,
  pageSize: 20,
});

it("removes the card and decrements total", () => {
  expect(nextListAfterDelete(page(["a", "b"], 2), "a", 1)).toEqual({
    data: page(["b"], 1),
    bumpPage: null,
  });
});

it("asks the list to open the previous page when the current page is emptied", () => {
  expect(nextListAfterDelete(page(["only"], 21), "only", 2)).toEqual({
    data: { entries: [], total: 20, page: 1, pageSize: 20 },
    bumpPage: 1,
  });
});

it("does not change the URL page on nearby-style page 1 empties", () => {
  expect(nextListAfterDelete(page(["only"], 1), "only", 1).bumpPage).toBeNull();
});
```

`app/entries/page.tsx` is a client module (`"use client"`). Vitest can import `nextListAfterDelete` once it is exported. If the page import pulls Next navigation, keep the helper at the top of that file (no hook).

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/entry-card-actions.test.ts tests/components/entries-list-delete.test.ts
```

Expected: FAIL — no 编辑/删除, `nextListAfterDelete` missing.

- [ ] **Step 3: Write minimal implementation**

In `app/entries/page.tsx` (above `function Records`):

```ts
import type { EntryPage } from "@/lib/entry-types";

export function nextListAfterDelete(
  data: EntryPage,
  id: string,
  page: number,
): { data: EntryPage; bumpPage: number | null } {
  const entries = data.entries.filter((entry) => entry.id !== id);
  const total = Math.max(0, data.total - 1);
  const emptiedLaterPage = entries.length === 0 && page > 1;
  return {
    data: { ...data, entries, total },
    bumpPage: emptiedLaterPage ? page - 1 : null,
  };
}
```

Inside `Records`, pass:

```tsx
<EntryCard
  key={entry.id}
  entry={entry}
  source={source}
  onDeleted={(id) => {
    setData((current) => {
      if (!current) return current;
      const next = nextListAfterDelete(current, id, page);
      if (next.bumpPage !== null) {
        change({ page: String(next.bumpPage) });
        return current;
      }
      return next.data;
    });
  }}
/>
```

`EntryCard` owner actions (card is already a client component once it calls `useAuth`; add `"use client"` at the top if not present):

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { requestJson } from "@/lib/browser";
import EntryCoverCarousel from "@/components/EntryCoverCarousel";
import RatingStars from "@/components/RatingStars";
import type { Entry } from "@/lib/entries";
import type { EntryPhotoThumb } from "@/lib/photo-constants";

export function slidesForEntry(
  entry: Pick<Entry, "photos" | "cover_photo_url">,
): EntryPhotoThumb[] {
  if (entry.photos?.length)
    return [...entry.photos].sort((a, b) => a.sort - b.sort);
  if (entry.cover_photo_url)
    return [{ id: "cover", public_url: entry.cover_photo_url, sort: 0 }];
  return [];
}

export default function EntryCard({
  entry,
  source,
  onDeleted,
}: {
  entry: Entry;
  source?: string;
  onDeleted?: (id: string) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const from = source ? `?from=${encodeURIComponent(source)}` : "";
  const mine = user?.userId === entry.user_id;
  const location =
    entry.address_text ||
    (entry.lat !== null && entry.lng !== null
      ? `${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)}`
      : "未记录地点");

  async function remove() {
    if (!window.confirm("确定删除这条记录吗？")) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/entries/${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });
      onDeleted?.(entry.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel entry-card">
      <EntryCoverCarousel photos={slidesForEntry(entry)} />
      <div className="row between">
        <h2>
          <Link href={`/entries/${entry.id}${from}`}>{entry.name}</Link>
        </h2>
        <span className="rating" aria-label={`评分 ${entry.rating} 分`}>
          <RatingStars value={entry.rating} /> <small>{entry.rating} 分</small>
        </span>
      </div>
      <span className="pill">{entry.kind === "place" ? "餐饮" : "物品"}</span>
      <p className="muted">
        {location}
        {entry.distanceKm !== undefined &&
          ` · ${entry.distanceKm.toFixed(2)} 公里`}
      </p>
      <div>
        {entry.kind === "place"
          ? entry.cuisines.map((c) => (
              <span className="pill" key={c.id}>
                {c.name}
              </span>
            ))
          : entry.categories.map((c) => (
              <span className="pill" key={c.id}>
                {c.parent ? `${c.parent.name} / ` : ""}
                {c.name}
              </span>
            ))}
        {entry.tags.map((t) => (
          <span className="pill" key={t.id}>
            #{t.name}
          </span>
        ))}
      </div>
      {entry.note && (
        <p className="note">
          {entry.note.slice(0, 160)}
          {entry.note.length > 160 ? "…" : ""}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {mine && (
        <div className="entry-card-actions">
          <Link className="secondary" href={`/entries/${entry.id}/edit${from}`}>
            编辑
          </Link>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? "正在删除…" : "删除"}
          </button>
        </div>
      )}
    </article>
  );
}
```

CSS:

```css
.entry-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
```

`useAuth()` without a provider returns `user: null` (existing fallback), so `tests/components/rating-display.test.ts` and carousel tests stay owner-less.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/entry-card-actions.test.ts tests/components/entries-list-delete.test.ts tests/components/entry-cover-carousel.test.ts tests/components/rating-display.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/EntryCard.tsx app/entries/page.tsx app/globals.css tests/components/entry-card-actions.test.ts tests/components/entries-list-delete.test.ts
git commit -m "feat: let owners edit and delete from the list"
```

---

### Task 5: `updateEntry` + `PUT /api/entries/[id]`

**Files:**
- Modify: `lib/validations/entry.ts`
- Modify: `lib/entries.ts` (add `updateEntry`)
- Modify: `app/api/entries/[id]/route.ts`
- Modify: `tests/validations/entry.test.ts`
- Modify: `tests/entries/data.test.ts`
- Modify: `tests/api/entries.test.ts`

**Interfaces:**
- Consumes: `entryCreateSchema`, `EntryCreate`, `assertLeafCategoryIds`, `getEntry`, `requireUser`, `HttpError`, `privateJson`, `apiError`
- Produces:
  - `export type EntryUpdate = EntryCreate`
  - `export async function updateEntry(userId: string, id: string, parsed: EntryCreate): Promise<Entry>`
  - `export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response>`
  - Status: 401 「请先登录」; 404 「记录不存在」; 403 「只能编辑自己的记录」; 400 「不能更改记录类型」; 200 `{ entry }`
  - Body: `entryCreateSchema.parse({ ...body, kind: body.kind ?? existing.kind })` then reject if `parsed.kind !== existing.kind`
  - `updateEntry` updates `name, note, rating, lat, lng, address_text, updated_at`; never `user_id` / `kind` / `created_at` / photos; replaces cuisine/category/tag joins

- [ ] **Step 1: Write the failing tests**

Append to `tests/validations/entry.test.ts`:

```ts
import { entryCreateSchema, type EntryCreate, type EntryUpdate } from '@/lib/validations/entry';

it('treats EntryUpdate as the create payload so kind stays in the same schema', () => {
  const parsed: EntryUpdate = entryCreateSchema.parse(place);
  const create: EntryCreate = parsed;
  expect(create.kind).toBe('place');
  expect(entryCreateSchema.safeParse({ ...place, kind: 'item', categoryIds: [id] }).success).toBe(true);
});
```

In `tests/entries/data.test.ts`, add `"update"` to the mocked builder ops array:

```ts
for (const op of ['select', 'eq', 'not', 'in', 'is', 'order', 'limit', 'insert', 'update', 'upsert', 'delete', 'single', 'maybeSingle']) {
```

Import `updateEntry` and append:

```ts
it('updates mutable fields and replaces associations without touching kind or photos', async () => {
  const placeParsed = {
    kind: 'place' as const,
    name: '新面馆',
    rating: 5,
    lat: 30,
    lng: 120,
    cuisineIds: [id],
    tagNames: ['清爽'],
  };
  db.results.push(
    { data: raw, error: null },
    { data: [], error: null },
    { error: null },
    { error: null },
    { error: null },
    { error: null },
    { error: null },
    { data: [{ id: 't', name: '清爽' }], error: null },
    { error: null },
    { data: { ...raw, name: '新面馆', rating: 5, lat: 30, lng: 120, entry_cuisines: [{ cuisines: { id, name: '本帮' } }], entry_tags: [{ tags: { id: 't', name: '清爽' } }] }, error: null },
    { data: [], error: null },
  );
  const entry = await updateEntry('u', 'e', placeParsed);
  expect(entry?.name).toBe('新面馆');
  const entriesUpdate = db.queries.find((query) => query.table === 'entries' && query.ops[0]?.[0] === 'update');
  expect(entriesUpdate?.ops[0]?.[1]).toMatchObject({
    name: '新面馆',
    rating: 5,
    lat: 30,
    lng: 120,
  });
  expect(entriesUpdate?.ops[0]?.[1]).not.toHaveProperty('kind');
  expect(entriesUpdate?.ops[0]?.[1]).not.toHaveProperty('user_id');
  expect(db.queries.some((query) => query.table === 'entry_photos')).toBe(false);
  expect(db.queries.filter((query) => query.table === 'entry_cuisines').map((query) => query.ops[0]?.[0])).toEqual([
    'delete',
    'insert',
  ]);
});

it('rejects a kind change inside updateEntry', async () => {
  db.results.push({ data: raw, error: null });
  await expect(
    updateEntry('u', 'e', { kind: 'item', name: 'IPA', rating: 5, categoryIds: [id], tagNames: [] }),
  ).rejects.toMatchObject({ status: 400, message: '不能更改记录类型' });
});

it('forbids updating another user record', async () => {
  db.results.push({ data: raw, error: null });
  await expect(updateEntry('other', 'e', {
    kind: 'place', name: '面馆', rating: 4, lat: 31, lng: 121, cuisineIds: [], tagNames: [],
  })).rejects.toMatchObject({ status: 403, message: '只能编辑自己的记录' });
});
```

The first `getEntry` inside `updateEntry` uses `select` + `maybeSingle` then `attachPhotos` (photo query). Queue `{ data: raw }` for the entry row and `{ data: [] }` for photos where `getEntry` runs. If a queued-result count is off, look at `db.queries` from the failure and add the missing `{ data: [], error: null }` for `entry_photos`. Do not invent a different helper.

In `tests/api/entries.test.ts` extend the hoisted mock and `vi.mock`:

```ts
const mocks = vi.hoisted(() => ({
  user: null as null | { userId: string },
  get: vi.fn(),
  list: vi.fn(),
  page: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  nearby: vi.fn(),
  roots: vi.fn(),
  children: vi.fn(),
  admin: vi.fn(),
}));
vi.mock('@/lib/entries', () => ({
  getEntry: mocks.get,
  listEntries: mocks.list,
  listEntryPage: mocks.page,
  createEntry: mocks.create,
  updateEntry: mocks.update,
  nearbyPlaceEntries: mocks.nearby,
  isPlaceEntry: (e: { kind: string; lat: number | null; lng: number | null }) =>
    e.kind === 'place' && e.lat !== null && e.lng !== null,
}));
```

Import `PUT` and add:

```ts
import { GET as detail, DELETE, PUT } from '@/app/api/entries/[id]/route';

const put = (body: unknown) =>
  new Request(`http://localhost/api/entries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

it('requires auth for PUT before DB', async () => {
  expect((await PUT(put({ kind: 'place', name: '面馆', rating: 4, lat: 31, lng: 121, cuisineIds: [], tagNames: [] }), { params: Promise.resolve({ id }) })).status).toBe(401);
  expect(mocks.update).not.toHaveBeenCalled();
});

it('forbids editing another user entry', async () => {
  mocks.user = { userId: 'u' };
  mocks.get.mockResolvedValue({ id, kind: 'place', user_id: 'other' });
  expect((await PUT(put({ kind: 'place', name: '面馆', rating: 4, lat: 31, lng: 121, cuisineIds: [], tagNames: [] }), { params: Promise.resolve({ id }) })).status).toBe(403);
  expect(mocks.update).not.toHaveBeenCalled();
});

it('returns 404 when the entry is missing', async () => {
  mocks.user = { userId: 'u' };
  mocks.get.mockResolvedValue(null);
  expect((await PUT(put({ kind: 'place', name: '面馆', rating: 4, lat: 31, lng: 121, cuisineIds: [], tagNames: [] }), { params: Promise.resolve({ id }) })).status).toBe(404);
});

it('rejects a kind change with a Chinese 400', async () => {
  mocks.user = { userId: 'u' };
  mocks.get.mockResolvedValue({ id, kind: 'place', user_id: 'u' });
  const response = await PUT(
    put({ kind: 'item', name: 'IPA', rating: 5, categoryIds: [id], tagNames: [] }),
    { params: Promise.resolve({ id }) },
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: '不能更改记录类型' });
  expect(mocks.update).not.toHaveBeenCalled();
});

it('fills omitted kind from the stored entry and updates', async () => {
  mocks.user = { userId: 'u' };
  mocks.get.mockResolvedValue({ id, kind: 'place', user_id: 'u' });
  mocks.update.mockResolvedValue({ id, kind: 'place', name: '新面馆' });
  const response = await PUT(
    put({ name: '新面馆', rating: 5, lat: 31, lng: 121, cuisineIds: [], tagNames: [] }),
    { params: Promise.resolve({ id }) },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ entry: { id, kind: 'place', name: '新面馆' } });
  expect(mocks.update).toHaveBeenCalledWith(
    'u',
    id,
    expect.objectContaining({ kind: 'place', name: '新面馆', rating: 5 }),
  );
});
```

Also add `PUT` to the existing unauthenticated loop in `requires auth for entries...` **or** keep the dedicated PUT 401 test above — do not drop the existing 401 coverage for GET/POST/DELETE.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/validations/entry.test.ts tests/entries/data.test.ts tests/api/entries.test.ts
```

Expected: FAIL — `EntryUpdate` / `updateEntry` / `PUT` missing.

- [ ] **Step 3: Write minimal implementation**

`lib/validations/entry.ts` — add after `EntryCreate`:

```ts
export type EntryUpdate = EntryCreate;
```

`lib/entries.ts` — add after `createEntry` (import `HttpError` from `@/lib/http`):

```ts
export async function updateEntry(
  userId: string,
  id: string,
  parsed: EntryCreate,
) {
  const existing = await getEntry(id);
  if (!existing) throw new HttpError("记录不存在", 404);
  if (existing.user_id !== userId)
    throw new HttpError("只能编辑自己的记录", 403);
  if (existing.kind !== parsed.kind)
    throw new HttpError("不能更改记录类型", 400);
  if (parsed.kind === "item") await assertLeafCategoryIds(parsed.categoryIds);

  const admin = createAdminClient();
  const fields =
    parsed.kind === "place"
      ? {
          name: parsed.name,
          note: parsed.note ?? null,
          rating: parsed.rating,
          lat: parsed.lat,
          lng: parsed.lng,
          address_text: parsed.address_text ?? null,
          updated_at: new Date().toISOString(),
        }
      : {
          name: parsed.name,
          note: parsed.note ?? null,
          rating: parsed.rating,
          lat: parsed.lat ?? null,
          lng: parsed.lng ?? null,
          address_text: parsed.address_text ?? null,
          updated_at: new Date().toISOString(),
        };

  const { error } = await admin
    .from("entries")
    .update(fields)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;

  for (const table of ["entry_cuisines", "entry_categories", "entry_tags"] as const) {
    const { error: wipe } = await admin.from(table).delete().eq("entry_id", id);
    if (wipe) throw wipe;
  }

  if (parsed.kind === "place" && parsed.cuisineIds.length) {
    const { error: join } = await admin.from("entry_cuisines").insert(
      parsed.cuisineIds.map((cuisine_id) => ({ entry_id: id, cuisine_id })),
    );
    if (join) throw join;
  }
  if (parsed.kind === "item") {
    const { error: join } = await admin.from("entry_categories").insert(
      parsed.categoryIds.map((category_id) => ({
        entry_id: id,
        category_id,
      })),
    );
    if (join) throw join;
  }
  if (parsed.tagNames.length) {
    const { data: tags, error: tagError } = await admin
      .from("tags")
      .upsert(
        parsed.tagNames.map((name) => ({ name })),
        { onConflict: "name" },
      )
      .select("id");
    if (tagError) throw tagError;
    const { error: joinError } = await admin
      .from("entry_tags")
      .insert(tags.map((tag) => ({ entry_id: id, tag_id: tag.id })));
    if (joinError) throw joinError;
  }

  const updated = await getEntry(id);
  if (!updated) throw new HttpError("记录不存在", 404);
  return updated;
}
```

Do not delete the entry row on association failure. Do not write `entry_photos`.

`app/api/entries/[id]/route.ts` — import `entryCreateSchema` and `updateEntry`, then:

```ts
export async function PUT(req: Request, ctx: Context) {
  try {
    const user = await requireUser(req);
    const id = z.uuid().parse((await ctx.params).id);
    const entry = await getEntry(id);
    if (!entry) throw new HttpError("记录不存在", 404);
    if (entry.user_id !== user.userId)
      throw new HttpError("只能编辑自己的记录", 403);
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = entryCreateSchema.parse({
      ...body,
      kind: body.kind ?? entry.kind,
    });
    if (parsed.kind !== entry.kind)
      throw new HttpError("不能更改记录类型", 400);
    return privateJson({
      entry: await updateEntry(user.userId, id, parsed),
    });
  } catch (error) {
    return apiError(error);
  }
}
```

Use `HttpError`, not `ZodError`, for the kind message so the client sees 「不能更改记录类型」 rather than 「输入格式不正确，请检查填写内容」.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/validations/entry.test.ts tests/entries/data.test.ts tests/api/entries.test.ts tests/api/permissions.test.ts
```

Expected: PASS. If `updateEntry` data tests fail on queued mock results, print `db.queries` and align the `db.results.push` list to the actual `from()` order (`entries` select → `entry_photos` → `entries` update → three deletes → inserts → tags → `getEntry` select + photos). Do not change production behavior to please the mock.

- [ ] **Step 5: Commit**

```bash
git add lib/validations/entry.ts lib/entries.ts app/api/entries/[id]/route.ts tests/validations/entry.test.ts tests/entries/data.test.ts tests/api/entries.test.ts
git commit -m "feat: add owner-only PUT to update an entry"
```

---

### Task 6: Edit page + `EntryForm` edit mode + detail link

**Files:**
- Modify: `components/EntryForm.tsx`
- Modify: `components/EntryPhotos.tsx` (`photos` / `onChange` typed as `EntryPhotoThumb[]`)
- Create: `app/entries/[id]/edit/page.tsx`
- Modify: `app/entries/[id]/page.tsx`
- Test: `tests/components/entry-form-edit.test.ts`
- Test: `tests/components/entry-detail.test.ts`

**Interfaces:**
- Consumes: `Entry`, `safeNext`, `requestJson`, `EntryPhotos`, `PUT /api/entries/:id` from Task 5, `GET /api/entries/:id`, `/api/auth/me`, `/api/cuisines`, `/api/tags`, `/api/photos/status`
- Produces:
  - `export default function EntryForm(props: { mode?: "create" | "edit"; entry?: Entry })`
  - Create (default): unchanged `POST /api/entries` + `PhotoPicker` + `router.push(/entries/{id}?from=)`
  - Edit: prefill from `entry`; kind shown as read-only `pill` (餐饮 / 物品), no radio; photos via `EntryPhotos`; submit `PUT` (not `jsonBody`, that helper hardcodes POST); success `router.push(safeNext(from || "/entries?scope=mine"))`
  - Edit page header: 「编辑记录」 + 「修改这条餐饮。」 / 「修改这件物品。」
  - Non-owner: 「只能编辑自己的记录」, form not submitted (pass `disabled` or do not render submit)
  - 「取消」 → `safeNext(from || "/entries?scope=mine")`
  - Detail owner block: `<Link href={/entries/{id}/edit?from=}>编辑</Link>` next to 删除我的记录

- [ ] **Step 1: Write the failing tests**

`tests/components/entry-form-edit.test.ts`:

```ts
// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/components/LocationField", () => ({
  default: () => createElement("div", { "data-testid": "location-field" }),
}));
vi.mock("@/components/CuisinePicker", () => ({
  default: () => createElement("div", { "data-testid": "cuisine-picker" }),
}));
vi.mock("@/components/CategoryPicker", () => ({
  default: () => createElement("div", { "data-testid": "category-picker" }),
}));
vi.mock("@/components/TagPicker", () => ({
  default: () => createElement("div", { "data-testid": "tag-picker" }),
}));
vi.mock("@/components/EntryPhotos", () => ({
  default: ({ entryId }: { entryId: string }) =>
    createElement("div", { "data-testid": "entry-photos" }, entryId),
}));
vi.mock("@/components/PhotoPicker", () => ({
  default: () => createElement("div", { "data-testid": "photo-picker" }),
  revokePickerPreviews: () => {},
}));

import EntryForm from "@/components/EntryForm";
import type { Entry } from "@/lib/entries";

const entry: Entry = {
  id: "e1",
  user_id: "owner",
  kind: "place",
  name: "巷口面馆",
  note: "汤好",
  rating: 4.5,
  lat: 31,
  lng: 121,
  address_text: "南京西路",
  created_at: "2026-11-01T00:00:00Z",
  cuisines: [{ id: "c1", name: "本帮" }],
  categories: [],
  tags: [{ id: "t1", name: "清爽" }],
};

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

function stubFetch(handler?: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (handler) {
      const override = handler(path, init);
      if (override !== undefined) return override;
    }
    if (path.includes("/api/cuisines")) return Response.json({ cuisines: [] });
    if (path.includes("/api/tags")) return Response.json({ tags: [] });
    if (path.includes("/api/photos/status"))
      return Response.json({ configured: true });
    return Response.json({ error: "unexpected " + path }, { status: 500 });
  });
}

it("prefills edit fields, locks kind, and saves with PUT back to the list", async () => {
  const puts: RequestInit[] = [];
  stubFetch((path, init) => {
    if (path === "/api/entries/e1" && init?.method === "PUT") {
      puts.push(init);
      return Response.json({ entry });
    }
  });
  window.history.replaceState(
    {},
    "",
    "/entries/e1/edit?from=%2Fentries%3Fscope%3Dall%26kind%3Dplace",
  );

  await act(async () => {
    render(createElement(EntryForm, { mode: "edit", entry }));
  });

  expect(screen.getByLabelText("餐饮名称")).toHaveDisplayValue("巷口面馆");
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.getByText("餐饮")).toBeTruthy();
  expect(screen.getByTestId("entry-photos")).toHaveTextContent("e1");
  expect(screen.queryByTestId("photo-picker")).toBeNull();
  expect(screen.getByRole("link", { name: "取消" }).getAttribute("href")).toBe(
    "/entries?scope=all&kind=place",
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
  });

  expect(puts).toHaveLength(1);
  expect(JSON.parse(String(puts[0]?.body))).toMatchObject({
    kind: "place",
    name: "巷口面馆",
    rating: 4.5,
    address_text: "南京西路",
  });
  expect(push).toHaveBeenCalledWith("/entries?scope=all&kind=place");
});

it("still posts a create and does not lock kind", async () => {
  const posts: string[] = [];
  stubFetch((path, init) => {
    if (path === "/api/entries" && (!init?.method || init.method === "POST")) {
      posts.push(path);
      return Response.json({ entry: { ...entry, id: "new" } });
    }
  });
  await act(async () => {
    render(createElement(EntryForm));
  });
  expect(screen.getByRole("radio", { name: "餐饮店" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "物品" })).toBeTruthy();
  expect(screen.getByTestId("photo-picker")).toBeTruthy();
  expect(screen.queryByTestId("entry-photos")).toBeNull();
});
```

`LocationField` is mocked so the test does not need map/geolocation. Create-mode assertion must still see radios and PhotoPicker.

Append to `tests/components/entry-detail.test.ts` (same fetch stub pattern already used):

```ts
it('links the owner to the edit page', async () => {
  vi.stubGlobal('fetch', async (url: string) => Response.json(
    String(url).includes('/api/auth/me')
      ? { user: { userId: 'user' } }
      : String(url).includes('/api/photos/status')
        ? { configured: true }
        : { entry },
  ));
  const params = Promise.resolve({ id: 'entry' });
  await act(async () => {
    render(createElement(Suspense, { fallback: '加载中' }, createElement(Detail, { params })));
  });
  const edit = await screen.findByRole('link', { name: '编辑' });
  expect(edit.getAttribute('href')).toMatch(/^\/entries\/entry\/edit\?from=/);
  expect(screen.getByRole('button', { name: '删除我的记录' })).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/entry-form-edit.test.ts tests/components/entry-detail.test.ts
```

Expected: FAIL — `EntryForm` has no `mode` prop; detail has no 编辑 link.

- [ ] **Step 3: Write minimal implementation**

`components/EntryPhotos.tsx` — change the props type only:

```ts
import type { EntryPhotoThumb } from "@/lib/photo-constants";

photos: EntryPhotoThumb[];
onChange: (photos: EntryPhotoThumb[]) => void;
```

Keep runtime add/delete as they are (they already use `id` / `public_url` / `sort`).

`components/EntryForm.tsx` — change the signature and state init, keep create submit intact:

```tsx
export default function EntryForm({
  mode = "create",
  entry,
}: {
  mode?: "create" | "edit";
  entry?: Entry;
}) {
  const editing = mode === "edit" && entry;
  const router = useRouter();
  const [kind, setKind] = useState<"place" | "item">(entry?.kind ?? "place");
  const [name, setName] = useState(entry?.name ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [address, setAddress] = useState(entry?.address_text ?? "");
  const [rating, setRating] = useState(entry?.rating ?? 4);
  const [location, setLocation] = useState({
    lat: entry?.lat != null ? String(entry.lat) : "",
    lng: entry?.lng != null ? String(entry.lng) : "",
  });
  const [cuisineIds, setCuisineIds] = useState<string[]>(
    entry?.cuisines.map((item) => item.id) ?? [],
  );
  const [categoryIds, setCategoryIds] = useState<string[]>(
    entry?.categories.map((item) => item.id) ?? [],
  );
  const [tags, setTags] = useState<string[]>(
    entry?.tags.map((item) => item.name) ?? [],
  );
  const [savedPhotos, setSavedPhotos] = useState(entry?.photos ?? []);
  // existing cuisines/suggestions/error/busy/ready/photos/storageReady state...
```

Kind UI when `editing`:

```tsx
{editing ? (
  <p>
    <span className="pill">{kind === "place" ? "餐饮" : "物品"}</span>
  </p>
) : (
  <fieldset>
    <legend>记录类型</legend>
    {/* existing radios */}
  </fieldset>
)}
```

Photos when `editing`:

```tsx
{editing ? (
  <EntryPhotos
    entryId={entry.id}
    photos={savedPhotos}
    isOwner
    storageReady={storageReady}
    onChange={setSavedPhotos}
  />
) : (
  <PhotoPicker
    value={photos}
    onChange={setPhotos}
    disabled={busy}
    storageReady={storageReady}
  />
)}
```

Import `EntryPhotos`. Edit submit — do not call `jsonBody` (it sets `method: "POST"`):

```tsx
if (editing) {
  if (kind === "item" && !categoryIds.length)
    throw new Error("请至少选择一个物品小类");
  const coords = {
    ...(location.lat.trim() ? { lat: Number(location.lat) } : {}),
    ...(location.lng.trim() ? { lng: Number(location.lng) } : {}),
  };
  await requestJson<{ entry: Entry }>(
    `/api/entries/${encodeURIComponent(entry.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        name,
        note,
        rating,
        ...coords,
        address_text: address,
        tagNames: tags,
        ...(kind === "place" ? { cuisineIds } : { categoryIds }),
      }),
    },
  );
  router.push(
    safeNext(
      new URLSearchParams(window.location.search).get("from") ||
        "/entries?scope=mine",
    ),
  );
  return;
}
```

Keep the existing `POST` + photo upload + `router.push(/entries/${entry.id}?...)` path for create.

Buttons:

```tsx
const from = safeNext(
  typeof window === "undefined"
    ? "/entries?scope=mine"
    : new URLSearchParams(window.location.search).get("from") ||
        "/entries?scope=mine",
);

<button disabled={busy || !ready}>
  {busy ? (editing ? "正在保存…" : "正在保存…") : editing ? "保存修改" : "保存记录"}
</button>
{editing && (
  <Link className="secondary" href={from}>
    取消
  </Link>
)}
```

Import `Link` from `next/link`. Create mode must not show 取消.

`app/entries/[id]/edit/page.tsx`:

```tsx
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { safeNext } from "@/lib/auth/redirect";
import { requestJson } from "@/lib/browser";
import EntryForm from "@/components/EntryForm";
import type { Entry } from "@/lib/entries";

export default function EditEntry({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [from, setFrom] = useState("/entries?scope=mine");

  useEffect(() => {
    setFrom(
      safeNext(
        new URLSearchParams(window.location.search).get("from") ||
          "/entries?scope=mine",
      ),
    );
    let active = true;
    Promise.all([
      requestJson<{ entry: Entry }>(`/api/entries/${encodeURIComponent(id)}`),
      requestJson<{ user: { userId: string } }>("/api/auth/me"),
    ])
      .then(([body, me]) => {
        if (!active) return;
        setEntry(body.entry);
        setUserId(me.user.userId);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const owner = entry && entry.user_id === userId;

  return (
    <>
      <div className="narrow page-intro">
        <h1>编辑记录</h1>
        <p className="muted">
          {entry
            ? entry.kind === "place"
              ? "修改这条餐饮。"
              : "修改这件物品。"
            : "正在加载记录…"}
        </p>
        <p>
          <Link href={from}>取消</Link>
        </p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {entry && !owner && userId && (
        <p className="error" role="alert">
          只能编辑自己的记录
        </p>
      )}
      {entry && owner && <EntryForm mode="edit" entry={entry} />}
    </>
  );
}
```

Non-owner: message, no form (cannot submit). 404/network: `error` from `requestJson` (「记录不存在」).

Detail `app/entries/[id]/page.tsx` — inside the existing `{entry.user_id === userId && (...)}` block, above the delete button:

```tsx
<p className="entry-card-actions">
  <Link
    className="secondary"
    href={`/entries/${entry.id}/edit?from=${encodeURIComponent(source)}`}
  >
    编辑
  </Link>
  <button
    className="danger"
    disabled={busy}
    onClick={() => void remove()}
  >
    {busy ? "正在删除…" : "删除我的记录"}
  </button>
</p>
```

Do not change the confirm string or DELETE call.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/entry-form-edit.test.ts tests/components/entry-detail.test.ts tests/components/photo-picker.test.ts
```

Expected: PASS. Create-mode radios and PhotoPicker still render.

- [ ] **Step 5: Commit**

```bash
git add components/EntryForm.tsx components/EntryPhotos.tsx app/entries/[id]/edit/page.tsx app/entries/[id]/page.tsx tests/components/entry-form-edit.test.ts tests/components/entry-detail.test.ts
git commit -m "feat: reuse EntryForm for locked-kind entry edits"
```

---

### Task 7: Dock highlight, CSS polish, smoke

**Files:**
- Test: `tests/layout/app-dock-edit.test.ts`
- Modify: `components/layout/AppDock.tsx` only if the new test fails (current rule already treats `/entries/*` except `/entries/new` as 记录)
- Modify: `app/globals.css` only if carousel/actions overflow on the existing 16:9 card
- No new dependencies

**Interfaces:**
- Consumes: `AppDock` `active("/entries")` ⇒ `pathname.startsWith("/entries") && pathname !== "/entries/new"`
- Produces: `/entries/{id}/edit` has `aria-current="page"` on 记录, not 增加

- [ ] **Step 1: Write the failing test**

`tests/layout/app-dock-edit.test.ts`:

```ts
// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/entries/11111111-1111-4111-8111-111111111111/edit",
}));

import AppDock from "@/components/layout/AppDock";

afterEach(cleanup);

it("keeps the edit route on 记录 instead of 增加", () => {
  render(createElement(AppDock));
  expect(
    screen.getByRole("link", { name: "记录" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen.getByRole("link", { name: "增加" }).getAttribute("aria-current"),
  ).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

```bash
npx vitest run tests/layout/app-dock-edit.test.ts tests/components/app-dock.test.ts
```

Expected: PASS already (do not edit `AppDock.tsx`). If FAIL, the `active` function was changed — restore:

```ts
const active = (href: string) =>
  href === "/"
    ? pathname === "/"
    : href === "/entries"
      ? pathname.startsWith("/entries") && pathname !== "/entries/new"
      : pathname === href;
```

- [ ] **Step 3: Full unit suite + CSS sanity**

```bash
npm test
```

Expected: all existing + new tests PASS.

If `.entry-cover-slide img` does not fill 16:9, add under the existing `.entry-cover img` rule:

```css
.entry-cover-slide img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

Do not add Swiper, embla, autoplay, 设为封面 API, kind switching, map popup changes, migrations, or env vars.

- [ ] **Step 4: Manual smoke (no R2 E2E required)**

After `npm test` is green, run `npm run build` then click through locally or on the preview:

1. Phone or device-mode: pinch-zoom does not enlarge `/`, `/entries`, `/login`.
2. List card with 0 photos: no cover. 1 photo: image, no dots. 2–3 photos: swipe + dots; title still opens detail.
3. `scope=all`: only own cards show 编辑 / 删除. Cancel confirm leaves the card. Confirm removes it without a full reload.
4. 编辑 → kind is a pill, save returns to the `from` list filter. Non-owner URL shows 「只能编辑自己的记录」.
5. Detail 编辑 reaches the same form; 删除我的记录 still works.
6. Map bubbles still show only `cover_photo_url`.

- [ ] **Step 5: Commit any CSS/dock fix, then stop**

```bash
git add tests/layout/app-dock-edit.test.ts app/globals.css components/layout/AppDock.tsx
git commit -m "test: keep edit route highlighted as records"
```

If nothing except the new test file changed:

```bash
git add tests/layout/app-dock-edit.test.ts
git commit -m "test: keep edit route highlighted as records"
```

Deploy after merge to ECS `food.nerosun.cn` (no migration, no new secrets). This plan PR stays docs-only until a later implementation PR.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| §4.1 / §6 viewport `maximumScale` + `userScalable` + iOS comment | Task 1 |
| §4.2 / §7.1 `EntryPhotoThumb`, `attachPhotos` mode cover/thin/full, `{ full: true }` alias | Task 2 |
| `listEntryPage` / nearby / `listEntries` → thin; map `attachCoverUrls` untouched | Task 2 |
| Cover order `sort===0` else first; `cover_photo_url` matches | Task 2 + Task 3 `slidesForEntry` |
| §5.1 scroll-snap, no autoplay, dots when >1, cover not a link, `touch-action: pan-x`, alt 封面照片 | Task 3 |
| Fallback when only `cover_photo_url` (rating test) | Task 3 |
| §5.2 owner 编辑/删除, confirm copy, DELETE, local remove, fail keeps card, empty page>1 | Task 4 |
| `useAuth()` inside card | Task 4 |
| §7.2 / §8 PUT + `updateEntry` + kind lock + owner 403 + EntryUpdate alias | Task 5 |
| §5.3 / §6 edit page, locked kind, EntryPhotos, PUT, `safeNext` back to list, 取消 | Task 6 |
| Non-owner 「只能编辑自己的记录」 | Task 6 |
| §5.4 detail 编辑 link | Task 6 |
| AppDock 记录 highlight | Task 7 |
| Chinese copy, warm CSS, no Swiper/embla, no kind change, no set-cover API, no map/migration/env | Global Constraints + Task 7 |
| §10 tests listed | Tasks 1–7 |
| §11 rollout ECS, no migration | Task 7 notes |

Out of scope left out of tasks: 设为封面 API, autoplay, kind conversion, wrapping the whole card in a link.
