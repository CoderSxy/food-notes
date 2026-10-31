# Leaflet Map Footprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Owner preference:** Prefer **Cloud Agent** for implementation; if unavailable, fall back to **Claude Code**. Spec: `docs/superpowers/specs/2026-10-31-leaflet-map-design.md`. Never commit secrets.

**Goal:** Add free Leaflet + OpenStreetMap footprint maps to food-notes: home overview (mine/all), detail mini-map, and registration click/drag location picker — with no new DB tables and no hydration warnings.

**Architecture:** Pure geo helpers filter mappable entries and owner scope. Shared OSM tile layer + default marker icon fix live under `components/map/`. Three map UIs (`EntriesMap`, `EntryMiniMap`, `LocationPickerMap`) are client-only and loaded via `next/dynamic(..., { ssr: false })`. Home wires overview + 「我的 / 全部」 using `/api/auth/me` `userId` and existing `listEntries` data; detail and `LocationField` mount mini/picker maps. No new routes or APIs.

**Tech Stack:** Next.js 15 App Router, React 19, `leaflet@1.9.4`, `react-leaflet@5.0.0`, `@types/leaflet@1.9.22`, Vitest + Testing Library (jsdom), Chinese UI copy, warm 食记 CSS tokens.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-31-leaflet-map-design.md`
- Prefer Cloud Agent; fallback Claude Code
- `leaflet` + `react-leaflet`; mount maps with `next/dynamic` and `{ ssr: false }`
- OSM standard tiles only (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
- No new DB tables; no `/map` route; no MapLibre; no iframe embeds; no China-specific tile vendors
- Markers: every entry with both `lat` and `lng`; home default scope 「我的」, toggle 「全部」
- Surfaces: home overview above list, detail read-only mini-map, `LocationPickerMap` click + drag on registration
- Warm 食记 styling (`.panel`, terracotta/apricot); Chinese UI copy
- Avoid Leaflet-related hydration attribute mismatches
- `npm test` and `npm run build` must pass
- Never commit secrets / `.env.local`
- Vitest include is `tests/**/*.test.ts` only — component tests must use `.test.ts` (not `.tsx`)
- Type name: `OwnerScope = 'mine' | 'all'` everywhere

## File Structure

```
package.json                         (+ leaflet, react-leaflet, @types/leaflet)
package-lock.json
lib/geo/map.ts                       # DEFAULT_CENTER, OSM constants, hasCoords, filterMappableEntries, filterByOwnerScope
components/map/leafletSetup.ts       # L.Icon.Default mergeOptions (webpack/Next marker fix)
components/map/MapTileLayer.tsx      # shared OSM TileLayer
components/map/FitBounds.tsx         # fitBounds helper for overview
components/map/MapErrorFallback.tsx  # 「地图加载失败」占位
components/map/EntriesMap.tsx        # home multi-marker + popup + scope (scope UI may live on page)
components/map/EntryMiniMap.tsx      # detail single read-only marker
components/map/LocationPickerMap.tsx # click + drag marker → lat/lng
components/map/dynamic.tsx           # next/dynamic wrappers ssr:false
components/LocationField.tsx         # optional withPicker → LocationPickerMap sync
app/page.tsx                         # userId, OwnerScope toggle, DynamicEntriesMap above list
app/entries/[id]/page.tsx            # DynamicEntryMiniMap when hasCoords
app/globals.css                      # .map-panel heights / warm chrome
tests/geo/map.test.ts
tests/components/location-field-picker.test.ts
tests/components/hydration.test.ts   # mock next/dynamic map modules if needed
README.md                            # OSM attribution note
```

Do **not** create: new migrations, `/app/map`, MapLibre deps, or new API routes.

---

### Task 1: Pure geo helpers + unit tests

**Files:**
- Create: `lib/geo/map.ts`
- Create: `tests/geo/map.test.ts`
- Reuse: `lib/geo/haversine.ts` (`LatLng` type only — do not change haversine)

**Interfaces:**
- Consumes: `Entry` from `@/lib/entries` (`lat: number | null`, `lng: number | null`, `user_id: string`); `LatLng` from `@/lib/geo/haversine`
- Produces:
  - `export type OwnerScope = 'mine' | 'all'`
  - `export type MappableEntry = Entry & { lat: number; lng: number }`
  - `export const DEFAULT_CENTER: LatLng` — China approx `{ lat: 35.8617, lng: 104.1954 }`
  - `export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'`
  - `export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'`
  - `export function hasCoords(entry: Pick<Entry, 'lat' | 'lng'>): entry is { lat: number; lng: number }`
  - `export function filterMappableEntries(entries: Entry[]): MappableEntry[]`
  - `export function filterByOwnerScope(entries: Entry[], scope: OwnerScope, userId: string): Entry[]`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/geo/map.test.ts
import { describe, expect, it } from 'vitest';
import type { Entry } from '@/lib/entries';
import {
  DEFAULT_CENTER,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  filterByOwnerScope,
  filterMappableEntries,
  hasCoords,
} from '@/lib/geo/map';

function entry(partial: Partial<Entry> & Pick<Entry, 'id' | 'user_id'>): Entry {
  return {
    kind: 'place',
    name: '测试',
    note: null,
    rating: 4,
    lat: null,
    lng: null,
    address_text: null,
    created_at: '2026-01-01T00:00:00.000Z',
    cuisines: [],
    categories: [],
    tags: [],
    ...partial,
  };
}

describe('hasCoords', () => {
  it('true only when both lat and lng are numbers', () => {
    expect(hasCoords({ lat: 31.2, lng: 121.5 })).toBe(true);
    expect(hasCoords({ lat: 0, lng: 0 })).toBe(true);
    expect(hasCoords({ lat: null, lng: 121.5 })).toBe(false);
    expect(hasCoords({ lat: 31.2, lng: null })).toBe(false);
    expect(hasCoords({ lat: null, lng: null })).toBe(false);
  });
});

describe('filterMappableEntries', () => {
  it('keeps place and item entries that have both coordinates', () => {
    const rows = [
      entry({ id: '1', user_id: 'u1', kind: 'place', lat: 31, lng: 121, name: '店A' }),
      entry({ id: '2', user_id: 'u1', kind: 'item', lat: null, lng: null, name: '无坐标物品' }),
      entry({ id: '3', user_id: 'u2', kind: 'item', lat: 30, lng: 120, name: '有坐标物品' }),
      entry({ id: '4', user_id: 'u2', kind: 'place', lat: 29, lng: null, name: '半缺' }),
    ];
    expect(filterMappableEntries(rows).map((e) => e.id)).toEqual(['1', '3']);
  });
});

describe('filterByOwnerScope', () => {
  const rows = [
    entry({ id: '1', user_id: 'me', lat: 1, lng: 1 }),
    entry({ id: '2', user_id: 'other', lat: 2, lng: 2 }),
  ];
  it('mine keeps only current user', () => {
    expect(filterByOwnerScope(rows, 'mine', 'me').map((e) => e.id)).toEqual(['1']);
  });
  it('all keeps every entry', () => {
    expect(filterByOwnerScope(rows, 'all', 'me').map((e) => e.id)).toEqual(['1', '2']);
  });
});

describe('OSM constants', () => {
  it('exports standard OSM tile URL, attribution, and China default center', () => {
    expect(OSM_TILE_URL).toBe('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(OSM_ATTRIBUTION).toContain('OpenStreetMap');
    expect(DEFAULT_CENTER.lat).toBeCloseTo(35.8617, 3);
    expect(DEFAULT_CENTER.lng).toBeCloseTo(104.1954, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/geo/map.test.ts`

Expected: FAIL — cannot resolve `@/lib/geo/map` (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/geo/map.ts
import type { Entry } from '@/lib/entries';
import type { LatLng } from '@/lib/geo/haversine';

export type OwnerScope = 'mine' | 'all';
export type MappableEntry = Entry & { lat: number; lng: number };

/** Approximate geographic center of China — used when no coords yet. */
export const DEFAULT_CENTER: LatLng = { lat: 35.8617, lng: 104.1954 };

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function hasCoords(
  entry: Pick<Entry, 'lat' | 'lng'>,
): entry is { lat: number; lng: number } {
  return typeof entry.lat === 'number' && typeof entry.lng === 'number';
}

export function filterMappableEntries(entries: Entry[]): MappableEntry[] {
  return entries.filter(hasCoords) as MappableEntry[];
}

export function filterByOwnerScope(
  entries: Entry[],
  scope: OwnerScope,
  userId: string,
): Entry[] {
  if (scope === 'all') return entries;
  return entries.filter((entry) => entry.user_id === userId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/geo/map.test.ts`

Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add lib/geo/map.ts tests/geo/map.test.ts
git commit -m "feat(map): add geo helpers for mappable entries and owner scope"
```

---

### Task 2: Install Leaflet deps + shared tile layer + default marker icons

**Files:**
- Modify: `package.json` / `package-lock.json` (via npm install)
- Create: `components/map/leafletSetup.ts`
- Create: `components/map/MapTileLayer.tsx`
- Create: `components/map/MapErrorFallback.tsx`

**Interfaces:**
- Consumes: `OSM_TILE_URL`, `OSM_ATTRIBUTION` from `@/lib/geo/map`
- Produces:
  - `setupDefaultMarkerIcons(): void` — call once before rendering markers
  - `MapTileLayer` React component (no props)
  - `MapErrorFallback` React component (`{ message?: string }`)

Pinned versions (React 19 peers):
- `leaflet@1.9.4`
- `react-leaflet@5.0.0`
- `@types/leaflet@1.9.22` (dev)

- [ ] **Step 1: Install dependencies**

```bash
npm install leaflet@1.9.4 react-leaflet@5.0.0
npm install -D @types/leaflet@1.9.22
```

Confirm `package.json` lists exact or locked versions; do not add MapLibre or other map libs.

- [ ] **Step 2: Add marker icon setup (Next/webpack broken default paths)**

```ts
// components/map/leafletSetup.ts
import L from 'leaflet';

let done = false;

/** Fix default marker icons under Next/webpack (missing image URLs). */
export function setupDefaultMarkerIcons(): void {
  if (done || typeof window === 'undefined') return;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
  done = true;
}
```

- [ ] **Step 3: Shared OSM tile layer**

```tsx
// components/map/MapTileLayer.tsx
'use client';

import { TileLayer } from 'react-leaflet';
import { OSM_ATTRIBUTION, OSM_TILE_URL } from '@/lib/geo/map';

export default function MapTileLayer() {
  return (
    <TileLayer
      attribution={OSM_ATTRIBUTION}
      url={OSM_TILE_URL}
      maxZoom={19}
    />
  );
}
```

- [ ] **Step 4: Error fallback placeholder**

```tsx
// components/map/MapErrorFallback.tsx
'use client';

export default function MapErrorFallback({
  message = '地图加载失败',
}: {
  message?: string;
}) {
  return (
    <div className="map-panel map-panel--error panel" role="status">
      <p className="muted">{message}</p>
      <p className="muted">列表、表单与手填经纬度仍可使用。</p>
    </div>
  );
}
```

- [ ] **Step 5: Smoke-check install**

Run: `node -e "require('leaflet'); require('react-leaflet'); console.log('ok')"`

Expected: prints `ok` (CJS require may warn on ESM — if it throws ESM-only, instead run `npx tsc --noEmit` or rely on next build later). Prefer:

Run: `npm ls leaflet react-leaflet @types/leaflet`

Expected: tree shows `leaflet@1.9.4`, `react-leaflet@5.0.0`, `@types/leaflet@1.9.22` without missing peers.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json \
  components/map/leafletSetup.ts \
  components/map/MapTileLayer.tsx \
  components/map/MapErrorFallback.tsx
git commit -m "chore(map): add leaflet deps and shared tile layer"
```

---

### Task 3: EntriesMap + dynamic import + home page wire-up

**Files:**
- Create: `components/map/FitBounds.tsx`
- Create: `components/map/EntriesMap.tsx`
- Create: `components/map/dynamic.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css` (add `.map-panel` / overview height — full polish in Task 6 is OK; add minimal height here so map is visible)
- Modify: `tests/components/hydration.test.ts` (mock `next/dynamic` map exports if hydration breaks)

**Interfaces:**
- Consumes: `MappableEntry`, `filterMappableEntries`, `filterByOwnerScope`, `OwnerScope`, `DEFAULT_CENTER` from `@/lib/geo/map`; `MapTileLayer`; `setupDefaultMarkerIcons`; `Entry` from `@/lib/entries`; `/api/auth/me` → `{ user: { userId: string, ... } }`
- Produces:
  - `EntriesMapProps = { entries: Entry[]; userId: string; scope: OwnerScope }`
  - `DynamicEntriesMap` — `next/dynamic(() => import('./EntriesMap'), { ssr: false, loading: ... })`
  - Home UI: 「我的」 / 「全部」 toggle (`aria-pressed`), map **above** the entry grid

- [ ] **Step 1: FitBounds helper**

```tsx
// components/map/FitBounds.tsx
'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLng } from '@/lib/geo/haversine';

export default function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = points.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }, [map, points]);
  return null;
}
```

- [ ] **Step 2: Implement EntriesMap**

```tsx
// components/map/EntriesMap.tsx
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { MapContainer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Entry } from '@/lib/entries';
import {
  DEFAULT_CENTER,
  filterByOwnerScope,
  filterMappableEntries,
  type OwnerScope,
} from '@/lib/geo/map';
import { setupDefaultMarkerIcons } from '@/components/map/leafletSetup';
import MapTileLayer from '@/components/map/MapTileLayer';
import FitBounds from '@/components/map/FitBounds';

export type EntriesMapProps = {
  entries: Entry[];
  userId: string;
  scope: OwnerScope;
};

export default function EntriesMap({ entries, userId, scope }: EntriesMapProps) {
  setupDefaultMarkerIcons();
  const points = useMemo(
    () => filterMappableEntries(filterByOwnerScope(entries, scope, userId)),
    [entries, scope, userId],
  );

  if (!points.length) {
    return (
      <div className="map-panel map-panel--overview panel empty" role="status">
        <h2>地图上还没有足迹</h2>
        <p className="muted">
          {scope === 'mine'
            ? '你还没有带坐标的记录。去记一笔，或切换到「全部」看看大家的足迹。'
            : '当前没有带坐标的记录。去记一笔，把味道钉在地图上吧。'}
        </p>
        <Link href="/entries/new">去记一笔 →</Link>
      </div>
    );
  }

  return (
    <div className="map-panel map-panel--overview panel" data-testid="entries-map">
      <MapContainer
        center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={5}
        className="map-canvas"
        scrollWheelZoom
      >
        <MapTileLayer />
        <FitBounds points={points} />
        {points.map((entry) => (
          <Marker key={entry.id} position={[entry.lat, entry.lng]}>
            <Popup>
              <strong>{entry.name}</strong>
              <div>{entry.rating} 分</div>
              <Link href={`/entries/${entry.id}`}>查看详情 →</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 3: Dynamic wrappers**

```tsx
// components/map/dynamic.tsx
'use client';

import dynamic from 'next/dynamic';
import MapErrorFallback from '@/components/map/MapErrorFallback';

const loading = () => <p className="muted map-panel map-panel--loading">地图加载中…</p>;

export const DynamicEntriesMap = dynamic(() => import('@/components/map/EntriesMap'), {
  ssr: false,
  loading,
});

export const DynamicEntryMiniMap = dynamic(() => import('@/components/map/EntryMiniMap'), {
  ssr: false,
  loading,
});

export const DynamicLocationPickerMap = dynamic(
  () => import('@/components/map/LocationPickerMap'),
  { ssr: false, loading },
);

export { MapErrorFallback };
```

Note: `EntryMiniMap` / `LocationPickerMap` are created in Tasks 4–5. For this task, either (a) create stub default exports that render `null` so dynamic resolves, then replace in later tasks, or (b) only export `DynamicEntriesMap` now and add the other two exports in Tasks 4–5. Prefer **(b)** — only add `DynamicEntriesMap` in this task; extend `dynamic.tsx` in Tasks 4 and 5.

Minimal `dynamic.tsx` for Task 3:

```tsx
'use client';

import dynamic from 'next/dynamic';

export const DynamicEntriesMap = dynamic(() => import('@/components/map/EntriesMap'), {
  ssr: false,
  loading: () => <p className="muted map-panel map-panel--loading">地图加载中…</p>,
});
```

- [ ] **Step 4: Wire home page**

Update `app/page.tsx` to:
1. Store `userId` from `/api/auth/me` when signed in.
2. Add `ownerScope` state: `OwnerScope`, default `'mine'`.
3. Render scope tabs 「我的」 / 「全部」 and `DynamicEntriesMap` **above** the entry grid (still inside the signed-in branch), using the same `entries` already loaded.
4. Keep existing kind / nearby / list behavior unchanged.

Target shape (merge carefully into existing file; keep nearby `LocationField` with `withPicker={false}` once that prop exists in Task 5 — until then omit the prop):

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import EntryCard from '@/components/EntryCard';
import LocationField, { type LocationValue } from '@/components/LocationField';
import { DynamicEntriesMap } from '@/components/map/dynamic';
import { requestJson } from '@/lib/browser';
import type { Entry } from '@/lib/entries';
import type { OwnerScope } from '@/lib/geo/map';

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kind, setKind] = useState<'' | 'place' | 'item'>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState('');
  const [ownerScope, setOwnerScope] = useState<OwnerScope>('mine');
  const [location, setLocation] = useState({ lat: '', lng: '' });
  const [nearbyPoint, setNearbyPoint] = useState<LocationValue | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me').then(async (r) => {
      if (!active) return;
      if (r.status === 401) { setLoading(false); return; }
      if (!r.ok) throw new Error('无法读取登录状态，请重试');
      const data = await r.json() as { user: { userId: string } };
      setSignedIn(true);
      setUserId(data.user.userId);
    }).catch((e) => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    setLoading(true); setError('');
    const url = nearbyPoint
      ? `/api/entries/nearby?lat=${encodeURIComponent(nearbyPoint.lat)}&lng=${encodeURIComponent(nearbyPoint.lng)}`
      : `/api/entries${kind ? `?kind=${kind}` : ''}`;
    requestJson<{ entries: Entry[] }>(url).then((data) => { if (active) setEntries(data.entries); })
      .catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [signedIn, kind, nearbyPoint, retry]);

  return <>
    <section className="hero">
      <p className="muted">属于大家的好味道收藏夹</p>
      <h1>美食地图</h1>
      <p>从街角小店到随手分享的零食，记下每一份喜欢的味道。</p>
      <div className="row">
        <Link className="button" href="/entries/new">＋ 记一笔</Link>
        <Link href="/recommend">探索附近 · AI 推荐 →</Link>
      </div>
    </section>
    {signedIn ? <>
      <section className="panel">
        <h2>发现美味</h2>
        <div className="tabs" aria-label="记录类型筛选">
          {([{ value: '', label: '全部' }, { value: 'place', label: '餐饮' }, { value: 'item', label: '物品' }] as const).map((tab) =>
            <button type="button" className="tab" key={tab.value} aria-pressed={kind === tab.value}
              onClick={() => { setKind(tab.value); setNearbyPoint(null); }}>{tab.label}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setKind('place'); setNearbyPoint({ ...location }); }}>
          <LocationField value={location} onChange={setLocation} />
          <div className="row">
            <button disabled={loading}>查看附近餐饮（5 公里）</button>
            <button className="secondary" disabled={loading} type="button"
              onClick={() => { setNearbyPoint(null); setRetry((n) => n + 1); }}>查看最新记录</button>
          </div>
        </form>
        {nearbyPoint && <p className="muted">正在展示附近餐饮，物品不参与附近查询。</p>}
      </section>

      <section className="map-section" aria-label="足迹地图">
        <div className="row between">
          <h2>足迹总览</h2>
          <div className="tabs" aria-label="足迹范围">
            {([{ value: 'mine' as const, label: '我的' }, { value: 'all' as const, label: '全部' }]).map((tab) =>
              <button type="button" className="tab" key={tab.value}
                aria-pressed={ownerScope === tab.value}
                onClick={() => setOwnerScope(tab.value)}>{tab.label}</button>)}
          </div>
        </div>
        {userId && <DynamicEntriesMap entries={entries} userId={userId} scope={ownerScope} />}
      </section>

      {loading ? <p role="status">正在寻找好味道…</p> : <>
        <p className="error" role="alert">{error}</p>
        {error ? <button className="secondary" onClick={() => setRetry((n) => n + 1)}>重新加载</button> : <>
          <div className="grid">{entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}</div>
          {!entries.length && <div className="panel empty"><h2>这里还没有记录</h2><p>第一份美味，等你来发现。</p><Link href="/entries/new">去记一笔 →</Link></div>}
        </>}
      </>}
    </> : <section className="panel empty">
      <h2>{loading ? '正在加载…' : '登录后，发现更多美味'}</h2>
      <p>登录后即可查看大家的记录，收藏自己的味觉记忆。</p>
      {error && <p className="error">{error}</p>}
      <Link className="button" href="/login">前往登录</Link>
    </section>}
  </>;
}
```

**Important:** Until Task 5 adds `withPicker`, either omit `withPicker={false}` or add a temporary optional prop stub on `LocationField` that accepts and ignores it. Prefer adding `withPicker?: boolean` to `LocationField` in Task 5; for Task 3 omit the prop so TypeScript stays clean, then set `withPicker={false}` on the home nearby field in Task 5.

- [ ] **Step 5: Minimal CSS so overview has height**

Append to `app/globals.css`:

```css
.map-section { margin: 24px 0; }
.map-panel { overflow: hidden; padding: 0; }
.map-panel--overview .map-canvas,
.map-canvas {
  height: 360px;
  width: 100%;
  border-radius: 20px;
}
.map-panel--loading,
.map-panel--error { padding: 24px 26px; }
```

- [ ] **Step 6: Fix hydration test if needed**

If `tests/components/hydration.test.ts` fails because `next/dynamic` / leaflet CSS load during `renderToString(Home)`, add near the other mocks:

```ts
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = () => null;
    Stub.displayName = 'DynamicStub';
    return Stub;
  },
}));
```

Also stub `leaflet/dist/leaflet.css` if Vite complains — via empty module mock in the test file or vitest alias. Keep the existing hydration assertions (no console errors).

- [ ] **Step 7: Run tests**

Run: `npm test -- tests/geo/map.test.ts tests/components/hydration.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/map/FitBounds.tsx components/map/EntriesMap.tsx \
  components/map/dynamic.tsx app/page.tsx app/globals.css \
  tests/components/hydration.test.ts
git commit -m "feat(map): home overview map with mine/all scope"
```

---

### Task 4: EntryMiniMap on detail page

**Files:**
- Create: `components/map/EntryMiniMap.tsx`
- Modify: `components/map/dynamic.tsx` (add `DynamicEntryMiniMap`)
- Modify: `app/entries/[id]/page.tsx`
- Create: `tests/components/entry-mini-map.test.ts` (hasCoords branch via helper + conditional render smoke)

**Interfaces:**
- Consumes: `hasCoords`, `DEFAULT_CENTER` (unused if always passed coords), `MapTileLayer`, `setupDefaultMarkerIcons`
- Produces: `EntryMiniMapProps = { lat: number; lng: number; name: string }`; detail page renders mini-map only when `hasCoords(entry)`

- [ ] **Step 1: Write failing test for detail branch logic**

```ts
// tests/components/entry-mini-map.test.ts
import { describe, expect, it } from 'vitest';
import { hasCoords } from '@/lib/geo/map';

describe('detail mini-map gate', () => {
  it('renders only when both coordinates exist', () => {
    expect(hasCoords({ lat: 31.2, lng: 121.5 })).toBe(true);
    expect(hasCoords({ lat: null, lng: 121.5 })).toBe(false);
  });
});
```

(This locks the gate used by the detail page; full Leaflet mount is covered by manual/dev smoke, not OSM network E2E.)

- [ ] **Step 2: Run test — helpers already pass; proceed to implement component**

Run: `npm test -- tests/components/entry-mini-map.test.ts`

Expected: PASS (uses existing helper). Keep the file as the acceptance anchor for the detail gate.

- [ ] **Step 3: Implement EntryMiniMap**

```tsx
// components/map/EntryMiniMap.tsx
'use client';

import { MapContainer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { setupDefaultMarkerIcons } from '@/components/map/leafletSetup';
import MapTileLayer from '@/components/map/MapTileLayer';

export type EntryMiniMapProps = { lat: number; lng: number; name: string };

export default function EntryMiniMap({ lat, lng, name }: EntryMiniMapProps) {
  setupDefaultMarkerIcons();
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  return (
    <div className="map-panel map-panel--mini panel" data-testid="entry-mini-map">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        className="map-canvas map-canvas--mini"
        scrollWheelZoom={false}
        dragging
      >
        <MapTileLayer />
        <Marker position={[lat, lng]} title={name} />
      </MapContainer>
      <p className="muted map-panel__caption">
        <a href={osmLink} target="_blank" rel="noreferrer">在 OpenStreetMap 打开</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Export DynamicEntryMiniMap**

Append to `components/map/dynamic.tsx`:

```tsx
export const DynamicEntryMiniMap = dynamic(() => import('@/components/map/EntryMiniMap'), {
  ssr: false,
  loading: () => <p className="muted map-panel map-panel--loading">地图加载中…</p>,
});
```

- [ ] **Step 5: Wire detail page**

In `app/entries/[id]/page.tsx`, import `hasCoords` and `DynamicEntryMiniMap`. After the lat/lng muted line (inside the `entry` branch), render:

```tsx
{hasCoords(entry) && (
  <DynamicEntryMiniMap lat={entry.lat} lng={entry.lng} name={entry.name} />
)}
```

Full detail return fragment for the article (keep delete / pills / note / date as today):

```tsx
{entry ? <article className="panel detail-card">
  {/* existing header, rating, address, lat/lng text, pills, note, date ... */}
  {hasCoords(entry) && (
    <DynamicEntryMiniMap lat={entry.lat} lng={entry.lng} name={entry.name} />
  )}
  {entry.user_id === userId && (
    <button className="danger" disabled={busy} onClick={() => void remove()}>
      {busy ? '正在删除…' : '删除我的记录'}
    </button>
  )}
</article> : !error && <p>正在加载记录…</p>}
```

- [ ] **Step 6: Mini-map CSS**

Append if missing:

```css
.map-canvas--mini { height: 220px; }
.map-panel__caption { padding: 8px 16px 14px; margin: 0; }
```

- [ ] **Step 7: Run tests**

Run: `npm test -- tests/components/entry-mini-map.test.ts tests/components/hydration.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/map/EntryMiniMap.tsx components/map/dynamic.tsx \
  app/entries/[id]/page.tsx app/globals.css \
  tests/components/entry-mini-map.test.ts
git commit -m "feat(map): read-only detail mini-map when coords exist"
```

---

### Task 5: LocationPickerMap + LocationField sync (click + drag)

**Files:**
- Create: `components/map/LocationPickerMap.tsx`
- Modify: `components/map/dynamic.tsx` (add `DynamicLocationPickerMap`)
- Modify: `components/LocationField.tsx`
- Modify: `app/page.tsx` (set `withPicker={false}` on nearby `LocationField`)
- Create: `tests/components/location-field-picker.test.ts`

**Interfaces:**
- Consumes: `LocationValue = { lat: string; lng: string }` from `LocationField`; `DEFAULT_CENTER`; `MapTileLayer`; `setupDefaultMarkerIcons`
- Produces:
  - `LocationPickerMapProps = { value: LocationValue; onChange: (value: LocationValue) => void }`
  - `LocationField` prop `withPicker?: boolean` (default `true` for registration; home nearby uses `false`)
  - Click map or drag marker → `onChange({ lat: String(lat), lng: String(lng) })`
  - When inputs change to valid numbers, marker moves; when empty/invalid, show map at `DEFAULT_CENTER` with tip to click/drag

- [ ] **Step 1: Write failing LocationField picker tests**

```ts
// tests/components/location-field-picker.test.ts
// @vitest-environment jsdom
import { createElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LocationField from '@/components/LocationField';

vi.mock('@/components/map/dynamic', () => ({
  DynamicLocationPickerMap: ({
    value,
    onChange,
  }: {
    value: { lat: string; lng: string };
    onChange: (v: { lat: string; lng: string }) => void;
  }) =>
    createElement(
      'div',
      { 'data-testid': 'location-picker-stub' },
      createElement(
        'button',
        {
          type: 'button',
          onClick: () => onChange({ lat: '31.2', lng: '121.5' }),
        },
        '模拟点选',
      ),
      createElement('span', null, `${value.lat},${value.lng}`),
    ),
}));

describe('LocationField with picker', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: undefined,
    });
  });

  it('renders picker by default and syncs click into lat/lng inputs', () => {
    const onChange = vi.fn();
    render(
      createElement(LocationField, {
        value: { lat: '', lng: '' },
        onChange,
      }),
    );
    expect(screen.getByTestId('location-picker-stub')).toBeTruthy();
    fireEvent.click(screen.getByText('模拟点选'));
    expect(onChange).toHaveBeenCalledWith({ lat: '31.2', lng: '121.5' });
  });

  it('hides picker when withPicker is false', () => {
    render(
      createElement(LocationField, {
        value: { lat: '', lng: '' },
        onChange: () => {},
        withPicker: false,
      }),
    );
    expect(screen.queryByTestId('location-picker-stub')).toBeNull();
  });
});
```

If `@testing-library/jest-dom` matchers are unused, stick to `toBeTruthy` / `toBeNull` as above (no `toBeInTheDocument` required).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/location-field-picker.test.ts`

Expected: FAIL — `withPicker` / picker stub not present in `LocationField`.

- [ ] **Step 3: Implement LocationPickerMap**

```tsx
// components/map/LocationPickerMap.tsx
'use client';

import { useMemo } from 'react';
import { MapContainer, Marker, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationValue } from '@/components/LocationField';
import { DEFAULT_CENTER } from '@/lib/geo/map';
import { setupDefaultMarkerIcons } from '@/components/map/leafletSetup';
import MapTileLayer from '@/components/map/MapTileLayer';

export type LocationPickerMapProps = {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

function parseCoord(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function ClickAndDragMarker({
  position,
  onChange,
}: {
  position: [number, number] | null;
  onChange: (value: LocationValue) => void;
}) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onChange({ lat: String(e.latlng.lat), lng: String(e.latlng.lng) });
    },
  });
  if (!position) return null;
  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          onChange({ lat: String(lat), lng: String(lng) });
        },
      }}
    />
  );
}

export default function LocationPickerMap({ value, onChange }: LocationPickerMapProps) {
  setupDefaultMarkerIcons();
  const lat = parseCoord(value.lat);
  const lng = parseCoord(value.lng);
  const hasPoint = lat !== null && lng !== null
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const center = useMemo(
    () => (hasPoint ? ([lat, lng] as [number, number]) : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng] as [number, number]),
    [hasPoint, lat, lng],
  );

  return (
    <div className="map-panel map-panel--picker" data-testid="location-picker-map">
      <p className="muted map-panel__hint">
        {hasPoint ? '可拖动钉子或点击地图调整位置。' : '点击地图放置钉子，也可拖动调整；亦可使用定位或手填经纬度。'}
      </p>
      <MapContainer
        center={center}
        zoom={hasPoint ? 15 : 4}
        className="map-canvas map-canvas--picker"
        scrollWheelZoom
      >
        <MapTileLayer />
        <ClickAndDragMarker
          position={hasPoint ? [lat, lng] : null}
          onChange={onChange}
        />
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 4: Export DynamicLocationPickerMap**

```tsx
export const DynamicLocationPickerMap = dynamic(
  () => import('@/components/map/LocationPickerMap'),
  {
    ssr: false,
    loading: () => <p className="muted map-panel map-panel--loading">地图加载中…</p>,
  },
);
```

- [ ] **Step 5: Integrate into LocationField**

Replace `components/LocationField.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { DynamicLocationPickerMap } from '@/components/map/dynamic';

export type LocationValue = { lat: string; lng: string };

export default function LocationField({
  value,
  onChange,
  required = true,
  withPicker = true,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  required?: boolean;
  withPicker?: boolean;
}) {
  const [message, setMessage] = useState('可获取当前位置，也可手动输入经纬度。');
  const [busy, setBusy] = useState(false);

  function locate() {
    if (!navigator.geolocation) {
      setMessage('浏览器不支持定位，请手动输入经纬度');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
        });
        setMessage('已获取当前位置，请确认是否为记录所在地');
        setBusy(false);
      },
      () => {
        setMessage('无法获取定位，请手动输入大致经纬度');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <fieldset>
      <legend>地点{required ? '（必填）' : '（选填）'}</legend>
      <button type="button" className="secondary" disabled={busy} onClick={locate}>
        {busy ? '正在定位…' : '获取当前位置'}
      </button>
      <p className="muted" role="status">{message}</p>
      {withPicker && (
        <DynamicLocationPickerMap value={value} onChange={onChange} />
      )}
      <div className="row">
        <div>
          <label htmlFor="lat">纬度（-90 至 90）</label>
          <input
            id="lat"
            type="number"
            step="any"
            min={-90}
            max={90}
            required={required}
            value={value.lat}
            onChange={(e) => onChange({ ...value, lat: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="lng">经度（-180 至 180）</label>
          <input
            id="lng"
            type="number"
            step="any"
            min={-180}
            max={180}
            required={required}
            value={value.lng}
            onChange={(e) => onChange({ ...value, lng: e.target.value })}
          />
        </div>
      </div>
    </fieldset>
  );
}
```

`EntryForm` already uses `<LocationField ... required={kind === 'place'} />` — default `withPicker={true}` covers registration click/drag. No `EntryForm.tsx` change required unless types break.

- [ ] **Step 6: Disable picker on home nearby LocationField**

In `app/page.tsx` nearby form:

```tsx
<LocationField value={location} onChange={setLocation} withPicker={false} />
```

- [ ] **Step 7: Picker CSS**

```css
.map-canvas--picker { height: 260px; }
.map-panel__hint { padding: 12px 16px 0; margin: 0; }
.map-panel--picker { margin: 12px 0; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; background: var(--card); }
```

- [ ] **Step 8: Run tests**

Run: `npm test -- tests/components/location-field-picker.test.ts tests/components/hydration.test.ts`

Expected: PASS. If EntryForm hydration fails due to dynamic picker, ensure `next/dynamic` mock from Task 3 still returns a null stub (covers `DynamicLocationPickerMap` as well).

- [ ] **Step 9: Commit**

```bash
git add components/map/LocationPickerMap.tsx components/map/dynamic.tsx \
  components/LocationField.tsx app/page.tsx app/globals.css \
  tests/components/location-field-picker.test.ts \
  tests/components/hydration.test.ts
git commit -m "feat(map): location picker with click and drag sync"
```

---

### Task 6: CSS polish, empty/error copy, README OSM attribution

**Files:**
- Modify: `app/globals.css` (consolidate map styles, warm chrome)
- Modify: `README.md` (mention Leaflet + OSM attribution)
- Optionally wrap dynamic imports with error UI: if a client error boundary is easy, use `MapErrorFallback`; otherwise keep loading + empty states already added

**Interfaces:**
- Consumes: existing map class names from Tasks 3–5
- Produces: polished heights; README section noting OSM © attribution requirement

- [ ] **Step 1: Finalize map CSS block in `app/globals.css`**

Ensure a single coherent block (replace earlier fragments if duplicated):

```css
/* Leaflet footprint maps */
.map-section { margin: 24px 0; }
.map-section h2 { margin: 0; font-family: var(--font-display); color: var(--ink); }
.map-panel {
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--card);
  box-shadow: var(--shadow);
}
.map-panel--overview .map-canvas,
.map-canvas { height: 360px; width: 100%; }
.map-canvas--mini { height: 220px; }
.map-canvas--picker { height: 260px; }
.map-panel--loading,
.map-panel--error,
.map-panel--overview.panel.empty { padding: 24px 26px; box-shadow: none; }
.map-panel__caption,
.map-panel__hint { padding: 8px 16px 14px; margin: 0; color: var(--muted); font-size: 14px; }
.map-panel--picker { margin: 12px 0; border-radius: 16px; }
/* Leaflet attribution stays readable on warm card */
.leaflet-container { font: inherit; background: color-mix(in srgb, var(--paper) 40%, white); }
@media (max-width: 720px) {
  .map-canvas { height: 280px; }
  .map-canvas--mini { height: 200px; }
  .map-canvas--picker { height: 240px; }
}
```

- [ ] **Step 2: README — map stack + attribution**

After the opening feature paragraph in `README.md`, add a short bullet/sentence (Chinese tone):

```markdown
地图足迹使用 [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/)，底图为 [OpenStreetMap](https://www.openstreetmap.org/copyright) 标准瓦片（需保留 © OpenStreetMap 署名）。首页展示有坐标登记的足迹（默认「我的」，可切换「全部」）；详情页有坐标时显示小地图；登记页支持地图点选与拖钉，并与定位/手填经纬度同步。本轮不包含独立 `/map` 页、路线或热力图。
```

Also ensure the local-run blurb still mentions `npm test` / `npm run build`.

- [ ] **Step 3: Manual checklist (dev)**

Run: `npm run dev`

Then verify locally (no commit of secrets):
1. Home: overview above list; default 「我的」; toggle 「全部」; popup name/rating/link; empty copy when no points.
2. Detail with coords: mini-map; without: no mini-map.
3. `/entries/new`: picker click + drag updates inputs; locate + manual still work; `item` can leave empty.
4. Browser console: no hydration attribute mismatch from Leaflet.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css README.md
git commit -m "docs(map): polish map CSS and OSM attribution in README"
```

---

### Task 7: Final verification gate

**Files:**
- None new — verify only; fix any leftover type/CSS/test breakage with tiny follow-up commits if needed

**Interfaces:**
- Consumes: all prior tasks
- Produces: green `npm test` and `npm run build`

- [ ] **Step 1: Run full unit suite**

Run: `npm test`

Expected: all tests PASS (including `tests/geo/map.test.ts`, location-field-picker, hydration, entry-mini-map gate).

- [ ] **Step 2: Production build**

Run: `npm run build`

Expected: Next.js build succeeds with no Leaflet SSR crash. Client-only dynamic maps must not execute `window`/`leaflet` during RSC/SSR.

- [ ] **Step 3: Spec acceptance self-check**

Confirm each design acceptance item:

| Spec acceptance | Task evidence |
| --- | --- |
| 首页总览，默认「我的」，可切「全部」，有坐标点均可见 | Task 3 `EntriesMap` + `OwnerScope` |
| marker 气泡含名称/评分/详情链接，且 `fitBounds` 合理 | Task 3 `Popup` + `FitBounds` |
| 详情有坐标显示只读小地图，无坐标不渲染 | Task 4 `hasCoords` gate |
| 登记可点选与拖钉，与定位/手填同步 | Task 5 `LocationPickerMap` + `LocationField` |
| 无新表；列表与表单在地图失败时仍可用 | Global constraints; `MapErrorFallback` / inputs remain |
| 无 Leaflet 相关 hydration 警告 | `ssr: false` + hydration test mock |

- [ ] **Step 4: Commit only if fixes were required**

If Step 1–2 forced small fixes:

```bash
git add -A
git status   # ensure no .env.local / secrets
git commit -m "fix(map): address final test and build gate issues"
```

If already green, no commit.

---

## Self-review (author)

**Spec coverage:** Home overview + mine/all (Task 3), popups/fitBounds (Task 3), detail mini-map gate (Task 4), click/drag picker sync (Task 5), no new tables / OSM-only / no `/map` (Global Constraints + Tasks 2–6), hydration avoidance (dynamic `ssr: false` + Task 3/5 test mocks), Chinese warm UI + README attribution (Task 6), test/build gate (Task 7). Out-of-scope MapLibre/iframe/China tiles/route heat never introduced.

**Placeholder scan:** No TBD/TODO; each code step includes concrete files and commands.

**Type consistency:** `OwnerScope = 'mine' | 'all'`; `MappableEntry`; `LocationValue = { lat: string; lng: string }`; `EntriesMapProps`, `EntryMiniMapProps`, `LocationPickerMapProps` align across tasks; helpers `hasCoords` / `filterMappableEntries` / `filterByOwnerScope` reused by UI.

