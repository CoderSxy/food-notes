# Entries + Item Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Owner preference:** Prefer Codex CLI `codex exec -m gpt-6.1-sol -c 'model_reasoning_effort="medium"'` in repo root. Never commit secrets.

**Goal:** Migrate `foods` into unified `entries` with `kind=place|item`, add hierarchical `categories` for items, and ship list/create/detail UX with filters—without changing map/SMS scope.

**Architecture:** Additive Supabase migration renames foods→entries and introduces categories + entry_categories. App layer gains `lib/entries.ts` and Zod schemas that branch on `kind`. `/api/foods*` remains as thin proxies to place-only behavior during transition; new `/api/entries*` and `/api/categories` are canonical. Nearby AI continues to use place entries with coordinates only.

**Tech Stack:** Existing Next.js 15, Supabase, Zod, Vitest, Tailwind.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-28-entries-items-design.md`
- Item location optional; place lat/lng required
- Cuisines stay for place only; items use category tree (leaf only)
- Tags shared; rating 1–5
- AI nearby: `kind=place` with coords only
- No map footprints, no real SMS this plan
- UI copy Chinese; no secrets in git
- Codex model: `gpt-6.1-sol` medium when used

## File Structure

```
supabase/migrations/002_entries_items.sql
supabase/seed_categories.sql
lib/validations/entry.ts
lib/entries.ts
lib/categories.ts
app/api/categories/route.ts
app/api/entries/route.ts
app/api/entries/[id]/route.ts
app/api/entries/nearby/route.ts
app/api/foods/*          (proxy to entries place-only)
components/CategoryPicker.tsx
components/EntryCard.tsx     (evolve FoodCard or replace)
components/EntryForm.tsx     (evolve FoodForm)
app/page.tsx                 (filter tabs)
app/entries/new/page.tsx     (or keep foods/new with kind)
app/entries/[id]/page.tsx
tests/validations/entry.test.ts
tests/entries/hydrate.test.ts
```

---

### Task 1: Migration SQL — foods → entries + categories

**Files:**
- Create: `supabase/migrations/002_entries_items.sql`
- Create: `supabase/seed_categories.sql`
- Modify: `README.md` (how to apply 002 + seed)

**Interfaces:**
- Produces tables/columns: `entries.kind`, nullable `lat/lng` with check, `categories`, `entry_categories`, renamed join tables

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/002_entries_items.sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  unique (parent_id, name)
);
create index categories_parent_idx on public.categories (parent_id);

alter table public.foods rename to entries;
alter table public.entries add column kind text not null default 'place'
  check (kind in ('place', 'item'));

alter table public.food_cuisines rename to entry_cuisines;
alter table public.entry_cuisines rename column food_id to entry_id;

alter table public.food_tags rename to entry_tags;
alter table public.entry_tags rename column food_id to entry_id;

alter table public.entries alter column lat drop not null;
alter table public.entries alter column lng drop not null;

alter table public.entries drop constraint if exists entries_lat_check;
alter table public.entries drop constraint if exists entries_lng_check;
-- recreate range checks allowing null
alter table public.entries add constraint entries_lat_range check (lat is null or lat between -90 and 90);
alter table public.entries add constraint entries_lng_range check (lng is null or lng between -180 and 180);
alter table public.entries add constraint entries_place_requires_coords check (
  kind <> 'place' or (lat is not null and lng is not null)
);

create table public.entry_categories (
  entry_id uuid not null references public.entries(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (entry_id, category_id)
);

alter table public.categories enable row level security;
alter table public.entry_categories enable row level security;
```

Note: If original constraint names differ, discover with `\d entries` / information_schema and adjust. Keep deny-by-default RLS.

- [ ] **Step 2: Seed categories**

```sql
-- supabase/seed_categories.sql
with roots as (
  insert into public.categories (name, slug, parent_id) values
    ('零食', 'snacks', null),
    ('酒水', 'alcohol', null),
    ('饮料', 'drinks', null),
    ('奶茶', 'milk-tea', null),
    ('咖啡', 'coffee', null)
  on conflict (slug) do update set name = excluded.name
  returning id, slug
)
insert into public.categories (name, slug, parent_id)
select v.name, v.slug, r.id
from roots r
join (values
  ('白酒', 'baijiu', 'alcohol'),
  ('红酒', 'red-wine', 'alcohol'),
  ('啤酒', 'beer', 'alcohol'),
  ('黄酒', 'huangjiu', 'alcohol'),
  ('清酒', 'sake', 'alcohol')
) as v(name, slug, parent_slug) on r.slug = v.parent_slug
on conflict (slug) do nothing;
```

If `on conflict (slug)` needs the unique on slug (already present), good. Parent uniqueness uses `(parent_id, name)`—slug remains global unique.

- [ ] **Step 3: Document in README** — run `001`, `seed.sql`, then `002`, `seed_categories.sql`.

- [ ] **Step 4: Commit**

```bash
git add supabase README.md
git commit -m "feat: migrate foods to entries and add item category tree"
```

---

### Task 2: Zod entry schemas + unit tests

**Files:**
- Create: `lib/validations/entry.ts`
- Create: `tests/validations/entry.test.ts`
- Keep: `lib/validations/food.ts` as re-export of place-only create for proxies OR delete after Task 4

**Interfaces:**
- Produces:
  - `entryKindSchema = z.enum(['place','item'])`
  - `entryCreateSchema` discriminated on `kind`
  - `nearbySchema` (reuse from food validations)

- [ ] **Step 1: Failing tests**

```ts
// tests/validations/entry.test.ts
import { describe, it, expect } from 'vitest';
import { entryCreateSchema } from '@/lib/validations/entry';

describe('entryCreateSchema', () => {
  it('requires coords for place', () => {
    const r = entryCreateSchema.safeParse({
      kind: 'place', name: '面馆', rating: 4, cuisineIds: [], tagNames: [],
    });
    expect(r.success).toBe(false);
  });
  it('allows item without coords when categoryIds present', () => {
    const r = entryCreateSchema.safeParse({
      kind: 'item', name: 'IPA', rating: 5,
      categoryIds: ['11111111-1111-1111-1111-111111111111'],
      tagNames: [],
    });
    expect(r.success).toBe(true);
  });
  it('rejects item with empty categoryIds', () => {
    const r = entryCreateSchema.safeParse({
      kind: 'item', name: 'IPA', rating: 5, categoryIds: [], tagNames: [],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- tests/validations/entry.test.ts
```

- [ ] **Step 3: Implement**

```ts
// lib/validations/entry.ts
import { z } from 'zod';

const tagNames = z
  .array(z.string().trim().min(1).max(30).transform((v) => v.replace(/\s+/g, ' ').toLowerCase()))
  .max(20)
  .transform((v) => [...new Set(v)]);

const placeCreate = z.object({
  kind: z.literal('place'),
  name: z.string().trim().min(1).max(100),
  note: z.string().trim().max(2000).optional(),
  rating: z.number().int().min(1).max(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address_text: z.string().trim().max(300).optional(),
  cuisineIds: z.array(z.uuid()).max(20).transform((v) => [...new Set(v)]),
  tagNames,
});

const itemCreate = z.object({
  kind: z.literal('item'),
  name: z.string().trim().min(1).max(100),
  note: z.string().trim().max(2000).optional(),
  rating: z.number().int().min(1).max(5),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address_text: z.string().trim().max(300).optional(),
  categoryIds: z.array(z.uuid()).min(1).max(20).transform((v) => [...new Set(v)]),
  tagNames,
});

export const entryCreateSchema = z.discriminatedUnion('kind', [placeCreate, itemCreate]);
```

- [ ] **Step 4: Run tests — pass**

```bash
npm test -- tests/validations/entry.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/validations/entry.ts tests/validations/entry.test.ts
git commit -m "feat: add entry create schemas for place and item"
```

---

### Task 3: `lib/entries.ts` + `lib/categories.ts`

**Files:**
- Create: `lib/entries.ts`
- Create: `lib/categories.ts`
- Create: `tests/entries/hydrate.test.ts`
- Modify: `lib/foods.ts` to re-export place helpers from entries for compatibility OR update all imports in same task

**Interfaces:**
- `Entry` type with `kind`, `cuisines`, `categories`, `tags`; `lat/lng` number | null
- `listEntries(filter?: { kind?: 'place'|'item' })`
- `getEntry(id)`, `nearbyPlaceEntries(point, radiusKm)` — only kind=place with non-null coords
- `createEntry(userId, parsed)` — writes joins; for item verify each categoryId is a leaf (`parent_id not null`)
- `listRootCategories()`, `listChildCategories(parentId)`, `assertLeafCategoryIds(ids)`

- [ ] **Step 1: Hydrate unit test**

```ts
// tests/entries/hydrate.test.ts
import { describe, it, expect } from 'vitest';
import { hydrateEntry } from '@/lib/entries';

describe('hydrateEntry', () => {
  it('maps joins', () => {
    const e = hydrateEntry({
      id: '1', user_id: 'u', kind: 'item', name: 'x', note: null, rating: 5,
      lat: null, lng: null, address_text: null, created_at: '',
      entry_cuisines: [],
      entry_categories: [{ categories: { id: 'c', name: '啤酒', parent_id: 'p' } }],
      entry_tags: [{ tags: { id: 't', name: '清爽' } }],
    } as never);
    expect(e.categories[0].name).toBe('啤酒');
    expect(e.tags[0].name).toBe('清爽');
  });
});
```

- [ ] **Step 2: Implement entries/categories modules** using `createAdminClient()`, select string:

`*, entry_cuisines(cuisines(id,name)), entry_categories(categories(id,name,parent_id)), entry_tags(tags(id,name))`

- [ ] **Step 3: Run**

```bash
npm test -- tests/entries/hydrate.test.ts tests/validations/entry.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/entries.ts lib/categories.ts tests/entries
git commit -m "feat: entries and categories data access layer"
```

---

### Task 4: API routes — categories + entries; foods proxy

**Files:**
- Create: `app/api/categories/route.ts`
- Create: `app/api/entries/route.ts`, `app/api/entries/[id]/route.ts`, `app/api/entries/nearby/route.ts`
- Modify: `app/api/foods/route.ts`, `[id]/route.ts`, `nearby/route.ts` to delegate to place-only entry helpers
- Modify: `app/api/recommend/route.ts` to call `nearbyPlaceEntries`

**Interfaces:**
- `GET /api/categories` → roots; `GET /api/categories?parent_id=uuid` → children
- `GET /api/entries?kind=place|item`
- `POST /api/entries` body = entryCreateSchema; auth required
- `GET/DELETE /api/entries/[id]`
- `GET /api/entries/nearby` same as foods nearby but place-only

- [ ] **Step 1: Implement categories GET**

```ts
// sketch
export async function GET(req: Request) {
  const parent = new URL(req.url).searchParams.get('parent_id');
  const rows = parent ? await listChildCategories(parent) : await listRootCategories();
  return Response.json({ categories: rows });
}
```

- [ ] **Step 2: Implement entries CRUD** mirroring existing foods routes but branching on kind for joins.

- [ ] **Step 3: Update foods routes** to filter `kind=place` and map field names so old clients still work.

- [ ] **Step 4: Update recommend** to ignore items.

- [ ] **Step 5: `npx tsc --noEmit` + `npm test`**

- [ ] **Step 6: Commit**

```bash
git add app/api lib
git commit -m "feat: entries and categories APIs; foods proxy place-only"
```

---

### Task 5: UI — CategoryPicker, EntryForm, filters, pages

**Files:**
- Create: `components/CategoryPicker.tsx`
- Modify: `components/FoodForm.tsx` → prefer rename/adapt to `EntryForm.tsx` with kind toggle
- Modify: `components/FoodCard.tsx` → show kind + category path or cuisine
- Modify: `app/page.tsx` — tabs 全部/餐饮/物品
- Modify: `app/foods/new/page.tsx` and detail OR add `app/entries/*` and redirect

**Interfaces:**
- CategoryPicker: load roots; on select root fetch children; multi-select leaves → `categoryIds`
- EntryForm: if place → LocationField required + CuisinePicker; if item → CategoryPicker + LocationField optional

- [ ] **Step 1: Build CategoryPicker** (client component)

- [ ] **Step 2: EntryForm with kind selector** 「餐饮店 / 物品」

- [ ] **Step 3: Home filter + card badges**

- [ ] **Step 4: Manual smoke checklist** (document in commit message): create item without lat; create place with cuisines; filter tabs; recommend still place-only

- [ ] **Step 5: Commit**

```bash
git add app components
git commit -m "feat: entry UI with item categories and home filters"
```

---

### Task 6: Tests polish + README

**Files:**
- Modify: `README.md` data model section
- Add/adjust API permission tests if paths changed
- Ensure `npm test` and `npm run build` pass with dummy env (lazy getEnv)

- [ ] **Step 1: Full test + build**

```bash
npm test
npm run build
```

- [ ] **Step 2: README** — explain entries kinds, category seed, API

- [ ] **Step 3: Commit + push**

```bash
git add README.md tests
git commit -m "docs: document entries and item categories"
git push origin main
```

---

## Spec coverage self-review

| Spec item | Task |
|-----------|------|
| categories tree + alcohol seed | 1 |
| entries kind + nullable coords check | 1 |
| entry_cuisines / entry_categories / tags | 1, 3, 4 |
| migration from foods | 1 |
| validations place vs item | 2 |
| APIs + foods proxy | 4 |
| UI filter + forms | 5 |
| AI nearby place-only | 4 |
| No map/SMS | — out of scope |

Placeholder scan: none intended.
