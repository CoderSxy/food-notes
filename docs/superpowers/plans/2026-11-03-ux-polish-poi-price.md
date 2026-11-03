# UX polish + Nominatim reverse geocode + item price Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution (locked):** Feature code is **not** for Cloud Agent. Implement with **Codex CLI**, model **`gpt-6.1-sol`**, **medium** effort, in an isolated **git worktree** (create it with superpowers:using-git-worktrees at execution time). This docs PR only adds the spec + this plan. Do not start Tasks 1–14 in the Cloud Agent session that authored these markdown files.

**Goal:** Ship the nine Nero-approved UX/data fixes in one implementation: round carousel dots, in-app delete confirm, card icon chrome, no new-entry intro, button pickers (kind exclusive, cuisine/subcategory multi), Nominatim reverse-geocode via server proxy, edit-mode photo previews, item major-category radios, optional CNY item price.

**Architecture:** Keep existing `entries` write paths. Add nullable `entries.price` (item-only). Add `GET /api/geocode/reverse` that proxies Nominatim with a hardcoded User-Agent, 8s timeout, and 1 req/s gate. New presentational `ConfirmDialog` and `formatPrice`. `LocationField` calls reverse after locate/pin-settle and pushes `address_text` through `onAddressResolved`. `EntryPhotos` holds real pending `PickerPhoto[]` so `PhotoPicker` can show blob thumbs.

**Tech Stack:** Next.js 15 App Router, React 19 client components, Zod 4, Vitest + Testing Library (jsdom), existing Leaflet picker (no geocode inside Leaflet), `globals.css` 食记 tokens, no new npm dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-03-ux-polish-poi-price-design.md` — implement exactly that, do not invent scope
- Chinese product copy; warm 食记 visual language (`--paper` / `--ink` / `--terracotta` / `--stamp` / `--danger`); 微软雅黑 already in CSS; no new fonts or icon libraries
- Cuisine stays **multi-select**; kind stays mutually exclusive; item subcategories stay multi-select
- Nominatim only, **no API key**, no Amap/Tencent/Mapbox; browser never talks to nominatim directly
- Secrets only in env; this work adds **none**
- Do not change cover reorder / set-cover API, SMS/OTP, map bubbles, AI recommend, legacy `/api/foods/*`, `FoodCard`, Dock, viewport, or the edit-page intro
- Vitest include is `tests/**/*.test.ts` only (not `.tsx`)
- `npm test`, `npm run lint`, `npm run build` must pass at the end
- Every task's requirements implicitly include this section

---

## File map

Do not add files outside this list. Do not modify `package.json` dependencies, `.env*`, `components/map/LocationPickerMap.tsx` internals (still coords-only), `app/api/foods/*`, or `components/FoodCard.tsx`.

### Create

| Path | Responsibility |
| --- | --- |
| `components/ConfirmDialog.tsx` | Controlled `role="dialog"` overlay; cancel-focused; Escape/backdrop dismiss never confirms |
| `lib/format-price.ts` | `formatPrice(price) => "12.5 元" \| null` |
| `lib/geocode/nominatim.ts` | Nominatim reverse fetch, UA, 8s timeout, 1 req/s gate, `display_name` trim/slice 300 |
| `app/api/geocode/reverse/route.ts` | `GET` auth + lat/lng validate + `{ address_text }` |
| `supabase/migrations/007_entry_item_price.sql` | nullable `price numeric(10,2)` + item-only / non-negative checks |
| `tests/layout/cover-dots.test.ts` | CSS overrides that stop global `button` stretching dots |
| `tests/layout/new-entry-intro.test.ts` | `/entries/new` has no 增加记录 intro |
| `tests/components/confirm-dialog.test.ts` | dismiss vs confirm |
| `tests/components/cuisine-picker.test.ts` | multi-select toggle buttons |
| `tests/components/category-picker.test.ts` | full-width major radios; leaf multi-select |
| `tests/format-price.test.ts` | yuan formatting |
| `tests/geocode/nominatim.test.ts` | `lon`, UA, no Authorization, timeout, rate limit |
| `tests/api/geocode-reverse.test.ts` | 401/400/200/429/504/502 |
| `tests/components/entry-photos.test.ts` | pending thumbs, upload success/fail, photo confirm dialog |

### Modify

| Path | Responsibility |
| --- | --- |
| `app/globals.css` | dots `::after`, confirm dialog, icon toolbar, `.choice-button` variants, price row |
| `components/EntryCard.tsx` | icon chrome + `ConfirmDialog` + price pill |
| `app/entries/[id]/page.tsx` | `ConfirmDialog` instead of `window.confirm`; show price |
| `components/EntryPhotos.tsx` | pending state; `existingCount`; photo `ConfirmDialog`; no immediate revoke |
| `components/PhotoPicker.tsx` | optional `existingCount`; `room = MAX_PHOTOS - existingCount - value.length` |
| `app/entries/new/page.tsx` | render only `EntryForm` |
| `components/EntryForm.tsx` | kind buttons 餐饮/物品; `onAddressResolved`; item price field |
| `components/CuisinePicker.tsx` | checkbox toggle buttons, still `string[]` |
| `components/CategoryPicker.tsx` | replace `<select>` with stacked radios; leaves stay multi |
| `components/LocationField.tsx` | reverse after locate + pin settle; wrap map `onChange` |
| `lib/validations/entry.ts` | item `price` schema |
| `lib/entries.ts` | `Entry.price: number \| null`; create/update write price for items only |
| `tests/components/entry-card-actions.test.ts` | dialog instead of `window.confirm`; icon accessible names |
| `tests/components/entry-form-edit.test.ts` | radio name 餐饮 (not 餐饮店); price omitted on place PUT |
| `tests/components/location-field-picker.test.ts` | locate/pin hit reverse; typing lat does not |
| `tests/components/photo-picker.test.ts` | `existingCount` caps remaining slots |
| `tests/validations/entry.test.ts` | price accept/reject; place strips `price` |
| `tests/entries/data.test.ts` | item insert/update `price` |
| `tests/components/entry-detail.test.ts` | confirm dialog; price label |
| Entry fixtures that must typecheck | add `price: null` where `Entry` literals exist |

### Do not touch

`components/map/LocationPickerMap.tsx` (except it already emits click/`dragend` coords — leave it), `components/map/DashboardMap.tsx`, `lib/entry-types.ts` MapPoint display, `app/api/foods/*`, `components/FoodCard.tsx`, `app/layout.tsx` viewport, `app/entries/[id]/edit/page.tsx` intro, `package.json`, `.env*`.

---

Locked names used by later tasks (do not rename):

```ts
export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string; // default 「取消」
  busy?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

export function formatPrice(
  price: number | null | undefined,
): string | null;

export const NOMINATIM_USER_AGENT =
  "food-notes/1.0 (https://food.nerosun.cn; reverse-geocode)";
export const NOMINATIM_TIMEOUT_MS = 8000;
export function formatNominatimDisplayName(
  raw: string | null | undefined,
): string | null;
export function resetNominatimGateForTests(): void;
export async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
): Promise<{ address_text: string | null }>;

// LocationField extra prop
onAddressResolved?: (addressText: string) => void;

// PhotoPicker extra prop
existingCount?: number; // default 0
```

`Entry.price: number | null` is required on the type. Hydrate with `price: raw.price ?? null`.

---

### Task 1: True-circle cover dots

**Files:**
- Modify: `app/globals.css` (`.entry-cover-dot` block)
- Test: `tests/layout/cover-dots.test.ts`
- Keep green: `tests/components/entry-cover-carousel.test.ts`

**Interfaces:**
- Consumes: existing `.entry-cover-dot` buttons (`aria-label="第 N 张"`, `aria-current`)
- Produces: 6px visual disc via `::after`; current disc 8px `--terracotta`; button hit ≥24px; overrides global `button` `min-height`/`padding`

- [ ] **Step 1: Write the failing test**

Create `tests/layout/cover-dots.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("overrides global button sizing so cover dots stay round", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const start = css.indexOf(".entry-cover-dot {");
  expect(start).toBeGreaterThan(-1);
  const current = css.indexOf(".entry-cover-dot[aria-current=\"true\"]");
  expect(current).toBeGreaterThan(start);
  const block = css.slice(start, current);
  expect(block).toMatch(/min-height:\s*0/);
  expect(block).toMatch(/min-width:\s*0/);
  expect(block).toContain("::after");
  expect(block).toMatch(/padding:\s*9px/);
  expect(css).toMatch(/\.entry-cover-dot::after[\s\S]*width:\s*6px/);
  expect(css).toMatch(/\.entry-cover-dot::after[\s\S]*height:\s*6px/);
  expect(css).toMatch(/\.entry-cover-dot::after[\s\S]*border-radius:\s*50%/);
  expect(css).toMatch(
    /\.entry-cover-dot\[aria-current="true"\]::after[\s\S]*width:\s*8px/,
  );
  expect(css).toMatch(
    /\.entry-cover-dot\[aria-current="true"\]::after[\s\S]*background:\s*var\(--terracotta\)/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/layout/cover-dots.test.ts
```

Expected: FAIL — current CSS has `width: 7px` on the button itself, no `::after`, no `min-height: 0`.

- [ ] **Step 3: Write minimal implementation**

Replace the `.entry-cover-dot` rules in `app/globals.css` with:

```css
.entry-cover-dot {
  position: relative;
  box-sizing: content-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 6px;
  height: 6px;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 9px;
  border: 0;
  border-radius: 0;
  background: transparent;
  appearance: none;
  flex: 0 0 auto;
  overflow: visible;
}
.entry-cover-dot::after {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
}
.entry-cover-dot[aria-current="true"] {
  background: transparent;
}
.entry-cover-dot[aria-current="true"]::after {
  width: 8px;
  height: 8px;
  background: var(--terracotta);
}
```

Do not change `.entry-cover-track` / slides / autoplay. Do not edit `EntryCoverCarousel.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/layout/cover-dots.test.ts tests/components/entry-cover-carousel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css tests/layout/cover-dots.test.ts
git commit -m "fix: keep list cover carousel dots as true circles"
```

---

### Task 2: In-app `ConfirmDialog`

**Files:**
- Create: `components/ConfirmDialog.tsx`
- Modify: `app/globals.css` (append confirm rules)
- Test: `tests/components/confirm-dialog.test.ts`

**Interfaces:**
- Consumes: nothing from later tasks
- Produces: `export type ConfirmDialogProps` and `export default function ConfirmDialog(props: ConfirmDialogProps)` as locked above. `cancelLabel` defaults to `"取消"`. `onDismiss` must not call `onConfirm`. Initial focus is the cancel button. Portal to `document.body`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/confirm-dialog.test.ts`:

```ts
// @vitest-environment jsdom
import { createElement, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ConfirmDialog from "@/components/ConfirmDialog";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(true);
  const [log, setLog] = useState("idle");
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "log" }, log),
    createElement(ConfirmDialog, {
      open,
      title: "删除记录",
      message: "确定删除这条记录吗？删除后无法恢复。",
      confirmLabel: "删除",
      busy: false,
      onConfirm: () => setLog("confirmed"),
      onDismiss: () => {
        setOpen(false);
        setLog("dismissed");
      },
    }),
  );
}

it("focuses cancel and confirms only from the danger button", () => {
  render(createElement(Harness));
  const dialog = screen.getByRole("dialog", { name: "删除记录" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "取消" }));
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.getByTestId("log").textContent).toBe("dismissed");
});

it("dismisses from backdrop and Escape without confirming", () => {
  const onConfirm = vi.fn();
  const onDismiss = vi.fn();
  const { rerender } = render(
    createElement(ConfirmDialog, {
      open: true,
      title: "删除照片",
      message: "确定删除这张照片吗？",
      confirmLabel: "删除",
      onConfirm,
      onDismiss,
    }),
  );
  fireEvent.click(screen.getByTestId("confirm-backdrop"));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(onDismiss).toHaveBeenCalledTimes(1);
  rerender(
    createElement(ConfirmDialog, {
      open: true,
      title: "删除照片",
      message: "确定删除这张照片吗？",
      confirmLabel: "删除",
      onConfirm,
      onDismiss,
    }),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onConfirm).not.toHaveBeenCalled();
  expect(onDismiss).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/confirm-dialog.test.ts
```

Expected: FAIL — module `@/components/ConfirmDialog` not found.

- [ ] **Step 3: Write minimal implementation**

Create `components/ConfirmDialog.tsx`:

```tsx
"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "取消",
  busy = false,
  onConfirm,
  onDismiss,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onDismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onDismiss]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="confirm-backdrop"
      data-testid="confirm-backdrop"
      onClick={() => {
        if (!busy) onDismiss();
      }}
    >
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onDismiss}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "正在删除…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

Append to `app/globals.css`:

```css
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(32 36 44 / 40%);
}
.confirm-dialog {
  width: min(100%, 360px);
  padding: 20px 22px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow);
}
.confirm-dialog h2 {
  font-size: 18px;
}
.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
@media (prefers-reduced-motion: reduce) {
  .confirm-backdrop,
  .confirm-dialog {
    transition: none;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/confirm-dialog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ConfirmDialog.tsx app/globals.css tests/components/confirm-dialog.test.ts
git commit -m "feat: add in-app confirm dialog for destructive actions"
```

---

### Task 3: List card icon chrome + confirm (items 2 + 3)

**Files:**
- Modify: `components/EntryCard.tsx`
- Modify: `app/globals.css`
- Modify: `tests/components/entry-card-actions.test.ts`
- Keep green: `tests/components/rating-display.test.ts`, `tests/components/entries-list-delete.test.ts`

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 2
- Produces: owner toolbar `.entry-card-toolbar` with `aria-label="编辑"` link and `aria-label="删除"` button; delete opens dialog copy 删除记录 / 确定删除这条记录吗？删除后无法恢复。 / 删除; dismiss never fetches; confirm calls existing `DELETE /api/entries/{id}` then `onDeleted`

- [ ] **Step 1: Write the failing tests**

Replace `tests/components/entry-card-actions.test.ts` with:

```ts
// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

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

it("shows edit and delete icon controls only for the owner", () => {
  const { rerender } = render(
    createElement(EntryCard, { entry, source: "/entries?scope=all" }),
  );
  expect(screen.getByRole("link", { name: "编辑" }).getAttribute("href")).toBe(
    "/entries/e1/edit?from=%2Fentries%3Fscope%3Dall",
  );
  expect(screen.getByRole("button", { name: "删除" })).toBeTruthy();
  expect(document.querySelector(".entry-card-actions")).toBeNull();
  expect(document.querySelector(".entry-card-toolbar")).toBeTruthy();

  auth.userId = "other";
  rerender(createElement(EntryCard, { entry, source: "/entries?scope=all" }));
  expect(screen.queryByRole("link", { name: "编辑" })).toBeNull();
  expect(screen.queryByRole("button", { name: "删除" })).toBeNull();
});

it("does not delete when the dialog is cancelled", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const onDeleted = vi.fn();
  render(createElement(EntryCard, { entry, onDeleted }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(screen.getByRole("dialog", { name: "删除记录" })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(onDeleted).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("deletes after dialog confirm and notifies the list", async () => {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    expect(String(url)).toBe("/api/entries/e1");
    expect(init?.method).toBe("DELETE");
    return Response.json({ ok: true });
  });
  const onDeleted = vi.fn();
  render(createElement(EntryCard, { entry, onDeleted }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(await screen.findByRole("button", { name: "正在删除…" })).toBeTruthy();
  await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith("e1"));
});

it("keeps the card and shows the API error when delete fails", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({ error: "只能删除自己的记录" }, { status: 403 }),
  );
  const onDeleted = vi.fn();
  render(createElement(EntryCard, { entry, onDeleted }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "只能删除自己的记录",
  );
  expect(onDeleted).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "删除" })).toBeTruthy();
});
```

Do not add `price` on this fixture yet (`Entry.price` lands in Task 8).

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/entry-card-actions.test.ts
```

Expected: FAIL — still a full-width 删除 button that calls `window.confirm`; no dialog.

- [ ] **Step 3: Write minimal implementation**

In `components/EntryCard.tsx`:

- Import `ConfirmDialog`.
- Add `const [confirming, setConfirming] = useState(false)`.
- `remove()` must **not** call `window.confirm`. Split: `askRemove` sets `confirming` true; `remove` (called from dialog `onConfirm`) performs DELETE as today.
- Replace `.entry-card-actions` with:

```tsx
{mine && (
  <div className="entry-card-toolbar">
    <Link
      className="icon-button"
      href={`/entries/${entry.id}/edit${from}`}
      aria-label="编辑"
      title="编辑"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M4 20h4l10-10-4-4L4 16v4zm12-14 4 4"
        />
      </svg>
    </Link>
    <button
      type="button"
      className="icon-button icon-button-danger"
      disabled={busy}
      aria-label={busy ? "正在删除…" : "删除"}
      title="删除"
      onClick={() => setConfirming(true)}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12"
        />
      </svg>
    </button>
    <ConfirmDialog
      open={confirming}
      title="删除记录"
      message="确定删除这条记录吗？删除后无法恢复。"
      confirmLabel="删除"
      busy={busy}
      onDismiss={() => setConfirming(false)}
      onConfirm={() => void remove()}
    />
  </div>
)}
```

`remove` no longer checks `window.confirm`. After success, `setConfirming(false)` then `onDeleted`. After failure, `setConfirming(false)` so the error on the card is visible.

Append CSS:

```css
.entry-card-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 8px;
}
a.icon-button,
button.icon-button {
  width: 40px;
  height: 40px;
  min-height: 0;
  padding: 0;
  border-radius: 10px;
  border-color: transparent;
  background: transparent;
  color: var(--muted);
}
a.icon-button:hover,
button.icon-button:hover {
  background: var(--stamp);
  color: var(--terracotta);
  text-decoration: none;
}
button.icon-button-danger:hover {
  color: var(--danger);
  background: #fff5f5;
}
```

Leave price display for Task 9.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/entry-card-actions.test.ts tests/components/rating-display.test.ts tests/components/entries-list-delete.test.ts tests/components/confirm-dialog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/EntryCard.tsx app/globals.css tests/components/entry-card-actions.test.ts
git commit -m "feat: move list edit/delete to icon controls with in-app confirm"
```

---

### Task 4: Detail-page delete confirm

**Files:**
- Modify: `app/entries/[id]/page.tsx`
- Modify: `tests/components/entry-detail.test.ts`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 2)
- Produces: detail still shows text 「编辑」 and 「删除我的记录」; clicking delete opens the same 删除记录 dialog; no `window.confirm`

- [ ] **Step 1: Write the failing test**

Append to `tests/components/entry-detail.test.ts`:

```ts
it("opens an in-app confirm and does not delete on cancel", async () => {
  const fetchMock = vi.fn(async (url: string) =>
    Response.json(
      String(url).includes("/api/auth/me")
        ? { user: { userId: "user" } }
        : String(url).includes("/api/photos/status")
          ? { configured: true }
          : { entry },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  const params = Promise.resolve({ id: "entry" });
  await act(async () => {
    render(
      createElement(
        Suspense,
        { fallback: "加载中" },
        createElement(Detail, { params }),
      ),
    );
  });
  fireEvent.click(await screen.findByRole("button", { name: "删除我的记录" }));
  expect(screen.getByRole("dialog", { name: "删除记录" })).toBeTruthy();
  const deleteCalls = fetchMock.mock.calls.filter(
    (call) =>
      String(call[0]).includes("/api/entries/") &&
      (call[1] as RequestInit | undefined)?.method === "DELETE",
  );
  expect(deleteCalls).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
```

Add `fireEvent` to the existing testing-library import.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/entry-detail.test.ts
```

Expected: FAIL — no dialog (or `window.confirm` still used).

- [ ] **Step 3: Write minimal implementation**

In `app/entries/[id]/page.tsx`:

- Import `ConfirmDialog`, add `const [confirming, setConfirming] = useState(false)`.
- Delete button `onClick={() => setConfirming(true)}` (do not call `remove` yet).
- Keep the label 「删除我的记录」.
- Render:

```tsx
<ConfirmDialog
  open={confirming}
  title="删除记录"
  message="确定删除这条记录吗？删除后无法恢复。"
  confirmLabel="删除"
  busy={busy}
  onDismiss={() => setConfirming(false)}
  onConfirm={() => void remove()}
/>
```

`remove()` must drop `window.confirm`. Keep `router.push(source)` on success.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/entry-detail.test.ts
```

Expected: PASS (existing date/map/edit tests too).

- [ ] **Step 5: Commit**

```bash
git add app/entries/[id]/page.tsx tests/components/entry-detail.test.ts
git commit -m "feat: confirm detail-page entry delete in-app"
```

---

### Task 5: Remove new-entry intro (item 4)

**Files:**
- Modify: `app/entries/new/page.tsx`
- Test: `tests/layout/new-entry-intro.test.ts`

**Interfaces:**
- Produces: page source contains `<EntryForm />` and neither `增加记录` nor `收藏餐饮`

- [ ] **Step 1: Write the failing test**

Create `tests/layout/new-entry-intro.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("starts the new-entry page on the form with no intro heading", () => {
  const source = readFileSync("app/entries/new/page.tsx", "utf8");
  expect(source).toContain("EntryForm");
  expect(source).not.toContain("增加记录");
  expect(source).not.toContain("收藏餐饮");
  expect(source).not.toContain("page-intro");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/layout/new-entry-intro.test.ts
```

Expected: FAIL — source still has the intro.

- [ ] **Step 3: Write minimal implementation**

Replace `app/entries/new/page.tsx` with:

```tsx
import EntryForm from "@/components/EntryForm";
export default function NewEntry() {
  return <EntryForm />;
}
```

Do not edit `app/entries/[id]/edit/page.tsx`.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/layout/new-entry-intro.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/entries/new/page.tsx tests/layout/new-entry-intro.test.ts
git commit -m "fix: drop new-entry page intro so the form starts immediately"
```

---

### Task 6: Kind + cuisine button controls (item 5)

**Files:**
- Modify: `components/EntryForm.tsx` (kind radios labels + class)
- Modify: `components/CuisinePicker.tsx`
- Modify: `app/globals.css`
- Modify: `tests/components/entry-form-edit.test.ts` (create radios named 餐饮)
- Test: `tests/components/cuisine-picker.test.ts`

**Interfaces:**
- Consumes: none
- Produces: kind radios accessible name 「餐饮」 / 「物品」 (not 「餐饮店」), mutually exclusive, class `choice-button` inside `.choice-buttons`. `CuisinePicker` still `value: string[]`; each cuisine is a checkbox styled as `choice-button choice-button--wrap`. Legend remains 「记录类型」 and 「菜系（可多选）」.

- [ ] **Step 1: Write the failing tests**

Update the create-mode assertion in `tests/components/entry-form-edit.test.ts`:

```ts
expect(screen.getByRole("radio", { name: "餐饮" })).toBeTruthy();
expect(screen.getByRole("radio", { name: "物品" })).toBeTruthy();
expect(screen.queryByRole("radio", { name: "餐饮店" })).toBeNull();
```

Create `tests/components/cuisine-picker.test.ts`:

```ts
// @vitest-environment jsdom
import { createElement, useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CuisinePicker from "@/components/CuisinePicker";

afterEach(cleanup);

const items = [
  { id: "a", name: "本帮" },
  { id: "b", name: "川菜" },
];

function Harness() {
  const [value, onChange] = useState<string[]>([]);
  return createElement("div", null, [
    createElement(CuisinePicker, { key: "p", items, value, onChange }),
    createElement("span", { key: "v", "data-testid": "ids" }, value.join(",")),
  ]);
}

it("toggles multiple cuisines on and off", () => {
  render(createElement(Harness));
  fireEvent.click(screen.getByRole("checkbox", { name: "本帮" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "川菜" }));
  expect(screen.getByTestId("ids").textContent).toBe("a,b");
  fireEvent.click(screen.getByRole("checkbox", { name: "本帮" }));
  expect(screen.getByTestId("ids").textContent).toBe("b");
  expect(screen.getByText("菜系（可多选）")).toBeTruthy();
  expect(document.querySelector("select")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/entry-form-edit.test.ts tests/components/cuisine-picker.test.ts
```

Expected: `entry-form-edit` FAIL because the create radios are still named 「餐饮店」. `cuisine-picker` may PASS on today's checkboxes (same accessible names); still restyle in Step 3. Do not skip Step 3 if cuisine tests are already green.

- [ ] **Step 3: Write minimal implementation**

In `components/EntryForm.tsx` kind fieldset, change labels to 「餐饮」 / 「物品」 and wrap with:

```tsx
<fieldset>
  <legend>记录类型</legend>
  <div className="choice-buttons">
    {([{ value: "place", label: "餐饮" }, { value: "item", label: "物品" }] as const).map(
      (option) => (
        <label className="choice-button" key={option.value}>
          <input
            type="radio"
            name="kind"
            value={option.value}
            checked={kind === option.value}
            onChange={() => setKind(option.value)}
          />
          {option.label}
        </label>
      ),
    )}
  </div>
</fieldset>
```

Replace `components/CuisinePicker.tsx` with:

```tsx
"use client";
import type { DictionaryItem } from "@/lib/foods";
export default function CuisinePicker({
  items,
  value,
  onChange,
}: {
  items: DictionaryItem[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend>菜系（可多选）</legend>
      <div className="choice-buttons choice-buttons--wrap">
        {items.map((item) => (
          <label className="choice-button choice-button--wrap" key={item.id}>
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, item.id]
                    : value.filter((id) => id !== item.id),
                )
              }
            />
            {item.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

Append CSS:

```css
.choice-buttons {
  display: flex;
  gap: 8px;
}
.choice-buttons--wrap {
  flex-wrap: wrap;
}
.choice-button {
  position: relative;
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  cursor: pointer;
}
.choice-button--wrap {
  flex: 0 0 auto;
  min-height: 36px;
}
.choice-button--block {
  display: flex;
  flex: none;
  width: 100%;
  justify-content: flex-start;
  margin: 6px 0;
}
.choice-button input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}
.choice-button:has(input:checked) {
  background: var(--stamp);
  border-color: var(--terracotta);
  color: var(--terracotta);
}
```

Do not add the price field yet. Do not change edit-mode locked kind pill.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/entry-form-edit.test.ts tests/components/cuisine-picker.test.ts tests/components/hydration.test.ts
```

Expected: PASS. If hydration of EntryForm fails because of the new markup, keep server and client markup identical (no `typeof window` in the kind fieldset).

- [ ] **Step 5: Commit**

```bash
git add components/EntryForm.tsx components/CuisinePicker.tsx app/globals.css tests/components/entry-form-edit.test.ts tests/components/cuisine-picker.test.ts
git commit -m "feat: restyle kind and cuisine pickers as buttons"
```

---

### Task 7: Item major-category full-width radios (item 8)

**Files:**
- Modify: `components/CategoryPicker.tsx`
- Test: `tests/components/category-picker.test.ts`
- Keep green: `tests/components/hydration.test.ts` (category picker case)

**Interfaces:**
- Consumes: `.choice-button--block` from Task 6
- Produces: no `#category-root` select; each root is `input type="radio" name="category-root"` inside a full-width `label.choice-button.choice-button--block`; children stay multi-select checkboxes (same `choice-button--wrap` as cuisine). Switching roots does **not** clear `value`. Legend stays 「物品分类（至少选择一个小类）」. Do not change `/api/categories` or `assertLeafCategoryIds`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/category-picker.test.ts`:

```ts
// @vitest-environment jsdom
import { createElement, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import CategoryPicker from "@/components/CategoryPicker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rootA = { id: "r1", name: "酒水", parent_id: null };
const rootB = { id: "r2", name: "零食", parent_id: null };
const beer = { id: "c1", name: "啤酒", parent_id: "r1" };
const wine = { id: "c2", name: "红酒", parent_id: "r1" };

function Harness() {
  const [value, onChange] = useState<string[]>([]);
  return createElement("div", null, [
    createElement(CategoryPicker, { key: "p", value, onChange }),
    createElement("span", { key: "v", "data-testid": "ids" }, value.join(",")),
  ]);
}

it("uses stacked radios for majors and keeps leaf multi-select", async () => {
  vi.stubGlobal("fetch", async (url: string) => {
    const path = String(url);
    if (path === "/api/categories") return Response.json({ categories: [rootA, rootB] });
    if (path.includes("parent_id=r1"))
      return Response.json({ categories: [beer, wine] });
    return Response.json({ categories: [] });
  });
  await act(async () => {
    render(createElement(Harness));
  });
  expect(document.querySelector("#category-root")).toBeNull();
  expect(document.querySelector("select")).toBeNull();
  fireEvent.click(await screen.findByRole("radio", { name: "酒水" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "啤酒" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "红酒" }));
  expect(screen.getByTestId("ids").textContent).toBe("c1,c2");
  fireEvent.click(screen.getByRole("radio", { name: "零食" }));
  expect(screen.getByTestId("ids").textContent).toBe("c1,c2");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/category-picker.test.ts
```

Expected: FAIL — `#category-root` select still exists.

- [ ] **Step 3: Write minimal implementation**

In `components/CategoryPicker.tsx` replace the `<label htmlFor="category-root">` + `<select>` with:

```tsx
<fieldset>
  <legend>物品分类（至少选择一个小类）</legend>
  <p className="muted">大类</p>
  <div className="choice-buttons choice-buttons--stack">
    {roots.map((c) => (
      <label className="choice-button choice-button--block" key={c.id}>
        <input
          type="radio"
          name="category-root"
          value={c.id}
          checked={rootId === c.id}
          onChange={() => {
            setRootId(c.id);
            setChildren([]);
          }}
        />
        {c.name}
      </label>
    ))}
  </div>
  {/* keep loading / error / empty-children copy unchanged */}
  <div className="choice-buttons choice-buttons--wrap">
    {children.map((c) => (
      <label className="choice-button choice-button--wrap" key={c.id}>
        <input
          type="checkbox"
          checked={value.includes(c.id)}
          disabled={!value.includes(c.id) && value.length >= 20}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? [...value, c.id]
                : value.filter((id) => id !== c.id),
            )
          }
        />
        {c.name}
      </label>
    ))}
  </div>
  {/* keep existing selected chips */}
</fieldset>
```

Add:

```css
.choice-buttons--stack {
  flex-direction: column;
}
```

Keep fetch logic, retry, chip 「大类 / 小类 ×」 identical.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/category-picker.test.ts tests/components/hydration.test.ts
```

Expected: PASS. Hydration: the empty `roots` first paint must match SSR (no select, just the legend/大类 heading).

- [ ] **Step 5: Commit**

```bash
git add components/CategoryPicker.tsx app/globals.css tests/components/category-picker.test.ts
git commit -m "feat: restyle item major categories as full-width radios"
```

---

### Task 8: Price data layer (item 9 schema + migration + writes)

**Files:**
- Create: `lib/format-price.ts`
- Create: `supabase/migrations/007_entry_item_price.sql`
- Create: `tests/format-price.test.ts`
- Modify: `lib/validations/entry.ts`
- Modify: `lib/entries.ts` (`Entry.price`, `createEntry` item insert, `updateEntry` fields)
- Modify: `tests/validations/entry.test.ts`
- Modify: `tests/entries/data.test.ts`
- Modify: every `Entry` fixture that TypeScript flags (add `price: null`)

**Interfaces:**
- Produces:
  - `formatPrice(price: number | null | undefined): string | null`
  - `itemCreateSchema.price` optional; omit/null/"" → `undefined`; numbers/`"12.5"` with ≥0 ≤999999.99 and at most 2 decimals
  - `placeCreateSchema` has no `price`; extra `price` is stripped
  - `Entry.price: number | null`
  - item `createEntry` insert includes `price` only when parsed
  - item `updateEntry` always sets `price: parsed.price ?? null`
  - place update object has **no** `price` key

- [ ] **Step 1: Write the failing tests**

Create `tests/format-price.test.ts`:

```ts
import { expect, it } from "vitest";
import { formatPrice } from "@/lib/format-price";

it("formats yuan without trailing zeros and hides empty values", () => {
  expect(formatPrice(12.5)).toBe("12.5 元");
  expect(formatPrice(12)).toBe("12 元");
  expect(formatPrice(12.5)).toBe("12.5 元");
  expect(formatPrice(0)).toBe("0 元");
  expect(formatPrice(null)).toBeNull();
  expect(formatPrice(undefined)).toBeNull();
});
```

Append to `tests/validations/entry.test.ts`:

```ts
it("accepts optional item prices with up to two decimals", () => {
  expect(entryCreateSchema.parse({ ...item, price: 12.5 }).price).toBe(12.5);
  expect(entryCreateSchema.parse({ ...item, price: 0 }).price).toBe(0);
  expect(entryCreateSchema.parse({ ...item, price: "12.50" }).price).toBe(12.5);
  expect(entryCreateSchema.parse(item).price).toBeUndefined();
  expect(entryCreateSchema.safeParse({ ...item, price: -1 }).success).toBe(false);
  expect(entryCreateSchema.safeParse({ ...item, price: 12.555 }).success).toBe(false);
  expect(entryCreateSchema.safeParse({ ...item, price: 10000000 }).success).toBe(false);
});

it("drops price on place payloads", () => {
  expect(
    entryCreateSchema.parse({ ...place, price: 12.5 }),
  ).not.toHaveProperty("price");
});
```

Append to `tests/entries/data.test.ts` (inside the describe):

```ts
it("writes item price on create and clears it on update", async () => {
  const priced = { ...item, price: 12.5 };
  db.results.push(
    { data: [{ id, parent_id: "root" }], error: null },
    { data: { id: "e" }, error: null },
    { error: null },
    {
      data: {
        ...raw,
        kind: "item",
        lat: null,
        lng: null,
        price: 12.5,
        entry_categories: [{ categories: { id, name: "啤酒", parent_id: "root" } }],
      },
      error: null,
    },
  );
  await createEntry("u", priced);
  expect(db.queries[1].ops).toContainEqual([
    "insert",
    { kind: "item", name: "IPA", rating: 5, price: 12.5, user_id: "u" },
  ]);
});

it("writes null item price when omitted and omits price on place updates", async () => {
  db.results.push(
    { data: { ...raw, kind: "item", user_id: "u", lat: null, lng: null }, error: null },
    { data: [], error: null },
    { data: [{ id, parent_id: "root" }], error: null },
    { error: null },
    { error: null },
    { error: null },
    { error: null },
    { error: null },
    { data: { ...raw, kind: "item", lat: null, lng: null, price: null, entry_categories: [{ categories: { id, name: "啤酒", parent_id: "root" } }], entry_cuisines: [], entry_tags: [] }, error: null },
    { data: [], error: null },
  );
  await updateEntry("u", "e", {
    kind: "item",
    name: "IPA",
    rating: 5,
    categoryIds: [id],
    tagNames: [],
  });
  const entriesUpdate = db.queries.find(
    (query) => query.table === "entries" && query.ops[0]?.[0] === "update",
  );
  expect(entriesUpdate?.ops[0]?.[1]).toMatchObject({ price: null });

  db.queries = [];
  db.results = [
    { data: raw, error: null },
    { data: [], error: null },
    { error: null },
    { error: null },
    { error: null },
    { error: null },
    { error: null },
    { data: [{ id: "t", name: "清爽" }], error: null },
    { error: null },
    { data: raw, error: null },
    { data: [], error: null },
  ];
  await updateEntry("u", "e", {
    kind: "place",
    name: "面馆",
    rating: 4,
    lat: 31,
    lng: 121,
    cuisineIds: [],
    tagNames: ["清爽"],
  });
  const placeUpdate = db.queries.find(
    (query) => query.table === "entries" && query.ops[0]?.[0] === "update",
  );
  expect(placeUpdate?.ops[0]?.[1]).not.toHaveProperty("price");
});
```

Create `tests/entries/price-migration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("adds a nullable item-only price column", () => {
  const sql = readFileSync("supabase/migrations/007_entry_item_price.sql", "utf8");
  expect(sql).toContain("add column price numeric(10,2)");
  expect(sql).toContain("entries_price_nonnegative");
  expect(sql).toContain("entries_price_item_only");
  expect(sql).toContain("kind = 'item'");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/format-price.test.ts tests/entries/price-migration.test.ts tests/validations/entry.test.ts tests/entries/data.test.ts
```

Expected: FAIL — missing module / column / schema.

- [ ] **Step 3: Write minimal implementation**

`lib/format-price.ts`:

```ts
export function formatPrice(
  price: number | null | undefined,
): string | null {
  if (price === null || price === undefined || Number.isNaN(price)) return null;
  const rounded = Math.round(price * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${text} 元`;
}
```

`supabase/migrations/007_entry_item_price.sql`:

```sql
alter table public.entries
  add column price numeric(10,2);

alter table public.entries
  add constraint entries_price_nonnegative
  check (price is null or price >= 0);

alter table public.entries
  add constraint entries_price_item_only
  check (price is null or kind = 'item');
```

If `007_*.sql` already exists on main when executing, name this file the next free number and update the migration test path to match. Do not rewrite older migrations.

`lib/validations/entry.ts` — add before `itemCreateSchema`:

```ts
const itemPriceSchema = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === "") return undefined;
    const raw = typeof value === "number" ? String(value) : value.trim();
    if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({ code: "custom", message: "invalid price" });
      return z.NEVER;
    }
    return Number(raw);
  });
```

Add `price: itemPriceSchema` to `itemCreateSchema` only.

`lib/entries.ts`:

- On `Entry` add `price: number | null`.
- In `hydrateEntry`, after spreading `entry`, set `price: entry.price ?? null`.
- Item branch of `createEntry` fields: strip `categoryIds`, include `price` only when `parsed.price !== undefined`.
- Item branch of `updateEntry` fields: add `price: parsed.price ?? null`.
- Place branch of `updateEntry`: do not add `price`.

Add `price: null` to every existing `Entry` / `raw` object literal that TypeScript reports. Files that currently construct entries:

- `tests/components/entry-card-actions.test.ts`
- `tests/components/entry-cover-carousel.test.ts`
- `tests/components/entry-detail.test.ts`
- `tests/components/entry-form-edit.test.ts`
- `tests/components/rating-display.test.ts`
- `tests/components/entries-list-delete.test.ts`
- `tests/entries/data.test.ts` (`raw`)
- `tests/geo/dashboard.test.ts`
- `tests/geo/map.test.ts`
- `tests/photos/attach.test.ts`

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/format-price.test.ts tests/entries/price-migration.test.ts tests/validations/entry.test.ts tests/entries/data.test.ts tests/api/entries.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/format-price.ts lib/validations/entry.ts lib/entries.ts supabase/migrations/007_entry_item_price.sql tests/format-price.test.ts tests/entries/price-migration.test.ts tests/validations/entry.test.ts tests/entries/data.test.ts tests/components tests/geo tests/photos
git commit -m "feat: add optional item price column, schema, and formatter"
```

---

### Task 9: Price field + card/detail display

**Files:**
- Modify: `components/EntryForm.tsx`
- Modify: `components/EntryCard.tsx`
- Modify: `app/entries/[id]/page.tsx`
- Modify: `app/globals.css` (`.price-field`)
- Modify: `tests/components/entry-form-edit.test.ts`
- Modify: `tests/components/entry-card-actions.test.ts` or `tests/components/rating-display.test.ts`
- Modify: `tests/components/entry-detail.test.ts`

**Interfaces:**
- Consumes: `formatPrice`, `Entry.price`, item schema from Task 8
- Produces: form field only when `kind === "item"`, after `CategoryPicker`, label 「价格（选填，元）」, placeholder 「例如：12.5」, static suffix 「元」. Empty → omit from POST/PUT (update item sends omit so schema → undefined → DB NULL via `parsed.price ?? null`). Place submit body has no `price`. Card/detail show a pill `12.5 元` when present; show nothing when null.

- [ ] **Step 1: Write the failing tests**

In `tests/components/entry-form-edit.test.ts` add an item-mode test:

```ts
it("shows a yuan price field for items and omits it for places", async () => {
  stubFetch();
  await act(async () => {
    render(createElement(EntryForm));
  });
  expect(screen.queryByLabelText("价格（选填，元）")).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "物品" }));
  const input = screen.getByLabelText("价格（选填，元）") as HTMLInputElement;
  expect(input.getAttribute("step")).toBe("0.01");
  expect(input.getAttribute("min")).toBe("0");
  expect(input.getAttribute("placeholder")).toBe("例如：12.5");
});
```

For item edit PUT, add a second entry fixture `itemEntry` with `kind: "item"`, `price: 12.5`, `categories: [{ id: "c1", name: "啤酒", parent_id: "r", parent: { name: "酒水" } }]`, empty cuisines, null coords. Assert saving with the field cleared does not send a number (omit or null). Front-end: empty string means omit `price` key; `updateEntry` then writes null.

Card test — append to `tests/components/entry-card-actions.test.ts`:

```ts
it("shows a price pill only when the item has a price", () => {
  const item = {
    ...entry,
    kind: "item" as const,
    lat: null,
    lng: null,
    price: 12.5,
  };
  const { rerender } = render(createElement(EntryCard, { entry: item }));
  expect(screen.getByText("12.5 元")).toBeTruthy();
  rerender(createElement(EntryCard, { entry: { ...item, price: null } }));
  expect(screen.queryByText(/元$/)).toBeNull();
});
```

Detail test — append:

```ts
it("shows the item price next to the rating when present", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(
      String(url).includes("/api/auth/me")
        ? { user: { userId: "user" } }
        : String(url).includes("/api/photos/status")
          ? { configured: true }
          : { entry: { ...entry, kind: "item", price: 12.5, lat: null, lng: null } },
    ),
  );
  await act(async () => {
    render(
      createElement(
        Suspense,
        { fallback: "加载中" },
        createElement(Detail, { params: Promise.resolve({ id: "entry" }) }),
      ),
    );
  });
  expect(await screen.findByText("12.5 元")).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/entry-form-edit.test.ts tests/components/entry-card-actions.test.ts tests/components/entry-detail.test.ts
```

Expected: FAIL — no price field/pill.

- [ ] **Step 3: Write minimal implementation**

`EntryForm.tsx`:

```ts
const [price, setPrice] = useState(
  entry?.price != null ? String(entry.price) : "",
);
```

After `CategoryPicker` (inside the item branch, so after the kind ternary that already chooses Cuisine vs Category):

```tsx
{kind === "item" && (
  <div className="price-field">
    <label htmlFor="price">价格（选填，元）</label>
    <div className="price-field-input">
      <input
        id="price"
        type="number"
        step="0.01"
        min={0}
        inputMode="decimal"
        placeholder="例如：12.5"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <span className="muted">元</span>
    </div>
  </div>
)}
```

In `submit`, before building the body:

```ts
if (kind === "item" && price.trim()) {
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(price.trim())) {
    throw new Error("请输入有效价格（元，最多两位小数）");
  }
}
```

Spread into JSON:

```ts
...(kind === "place"
  ? { cuisineIds }
  : {
      categoryIds,
      ...(price.trim() ? { price: Number(price.trim()) } : {}),
    }),
```

Place path must not include `price`.

`EntryCard.tsx` near tags:

```tsx
{formatPrice(entry.price) ? (
  <span className="pill">{formatPrice(entry.price)}</span>
) : null}
```

Call once:

```ts
const priceLabel = formatPrice(entry.price);
```

`app/entries/[id]/page.tsx` after the rating `<p>`:

```tsx
{formatPrice(entry.price) ? <p>{formatPrice(entry.price)}</p> : null}
```

Same single-binding pattern.

CSS:

```css
.price-field-input {
  display: flex;
  align-items: center;
  gap: 8px;
}
.price-field-input input {
  max-width: 160px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/entry-form-edit.test.ts tests/components/entry-card-actions.test.ts tests/components/entry-detail.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/EntryForm.tsx components/EntryCard.tsx app/entries/[id]/page.tsx app/globals.css tests/components/entry-form-edit.test.ts tests/components/entry-card-actions.test.ts tests/components/entry-detail.test.ts
git commit -m "feat: collect and display optional item prices in yuan"
```

---

### Task 10: Nominatim helper + reverse API (item 6 server)

**Files:**
- Create: `lib/geocode/nominatim.ts`
- Create: `app/api/geocode/reverse/route.ts`
- Test: `tests/geocode/nominatim.test.ts`
- Test: `tests/api/geocode-reverse.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `HttpError`, `apiError`, `privateJson`
- Produces: locked `NOMINATIM_USER_AGENT`, `NOMINATIM_TIMEOUT_MS` (8000), `formatNominatimDisplayName`, `resetNominatimGateForTests`, `reverseGeocodeNominatim(lat, lng)` → `{ address_text: string | null }`. Route `GET /api/geocode/reverse?lat=&lng=` (`lng` in query, `lon` upstream). Timeout 8s. Min 1s between upstream calls; if the wait would exceed remaining budget, throw `HttpError("地址查询过于频繁，请稍后再试", 429)`. Upstream 429 → same 429. Abort → 504 「查找地址超时，可稍后重试或手动填写」. Other upstream failures → 502 「暂时无法解析地址」. 400 「请提供有效的经纬度」. 401 「请先登录」. Success 200 `{ address_text }`. No Authorization header to Nominatim. `export const dynamic = "force-dynamic"`.

- [ ] **Step 1: Write the failing tests**

`tests/geocode/nominatim.test.ts`:

```ts
import { afterEach, expect, it, vi } from "vitest";
import {
  formatNominatimDisplayName,
  NOMINATIM_USER_AGENT,
  resetNominatimGateForTests,
  reverseGeocodeNominatim,
} from "@/lib/geocode/nominatim";

afterEach(() => {
  resetNominatimGateForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("trims and caps display_name at 300 characters", () => {
  expect(formatNominatimDisplayName("  南京  西路  ")).toBe("南京 西路");
  expect(formatNominatimDisplayName("")).toBeNull();
  expect(formatNominatimDisplayName("x".repeat(301))?.length).toBe(300);
});

it("calls Nominatim with lon, zh-CN, and the food-notes user agent", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    expect(url).toContain("nominatim.openstreetmap.org/reverse");
    expect(url).toContain("lon=121.5");
    expect(url).not.toContain("lng=");
    expect(url).toContain("format=jsonv2");
    expect(url).toContain("accept-language=zh-CN");
    expect(init?.headers).toMatchObject({
      "User-Agent": NOMINATIM_USER_AGENT,
      Accept: "application/json",
    });
    expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/Authorization/i);
    return Response.json({ display_name: "南京西路, 上海" });
  });
  vi.stubGlobal("fetch", fetchMock);
  await expect(reverseGeocodeNominatim(31.2, 121.5)).resolves.toEqual({
    address_text: "南京西路, 上海",
  });
  expect(NOMINATIM_USER_AGENT).toContain("food-notes");
  expect(NOMINATIM_USER_AGENT).toContain("food.nerosun.cn");
});
```

`tests/api/geocode-reverse.test.ts`:

```ts
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as null | { userId: string },
  reverse: vi.fn(),
}));

vi.mock("@/lib/auth/requestUser", () => ({
  requireUser: async () => {
    if (!mocks.user) {
      const { HttpError } = await import("@/lib/http");
      throw new HttpError("请先登录", 401);
    }
    return mocks.user;
  },
}));
vi.mock("@/lib/geocode/nominatim", () => ({
  reverseGeocodeNominatim: mocks.reverse,
}));

import { GET } from "@/app/api/geocode/reverse/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
});

const req = (query: string) =>
  new Request(`http://localhost/api/geocode/reverse?${query}`);

it("requires auth before calling Nominatim", async () => {
  expect((await GET(req("lat=31&lng=121"))).status).toBe(401);
  expect(mocks.reverse).not.toHaveBeenCalled();
});

it("rejects invalid coordinates", async () => {
  mocks.user = { userId: "u" };
  expect((await GET(req("lat=91&lng=121"))).status).toBe(400);
  expect((await GET(req(""))).status).toBe(400);
  expect(mocks.reverse).not.toHaveBeenCalled();
});

it("returns address_text from the helper", async () => {
  mocks.user = { userId: "u" };
  mocks.reverse.mockResolvedValue({ address_text: "南京西路" });
  const response = await GET(req("lat=31.2&lng=121.5"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ address_text: "南京西路" });
  expect(mocks.reverse).toHaveBeenCalledWith(31.2, 121.5);
});

it("maps helper HttpError status", async () => {
  mocks.user = { userId: "u" };
  const { HttpError } = await import("@/lib/http");
  mocks.reverse.mockRejectedValue(
    new HttpError("查找地址超时，可稍后重试或手动填写", 504),
  );
  expect((await GET(req("lat=31&lng=121"))).status).toBe(504);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/geocode/nominatim.test.ts tests/api/geocode-reverse.test.ts
```

Expected: FAIL — modules missing.

- [ ] **Step 3: Write minimal implementation**

Implement `lib/geocode/nominatim.ts` as specified in Interfaces: module-level gate, `AbortController` + `setTimeout` 8000ms (or remaining budget), `fetch` without Authorization, map status codes to `HttpError`, `formatNominatimDisplayName` on `display_name`. Export `resetNominatimGateForTests` that zeroes `lastStartedAt` and the mutex chain.

`app/api/geocode/reverse/route.ts`:

```ts
import { requireUser } from "@/lib/auth/requestUser";
import { reverseGeocodeNominatim } from "@/lib/geocode/nominatim";
import { apiError, HttpError, privateJson } from "@/lib/http";

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const params = new URL(req.url).searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new HttpError("请提供有效的经纬度", 400);
    }
    return privateJson(await reverseGeocodeNominatim(lat, lng));
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
```

Append this hanging-fetch case to `tests/geocode/nominatim.test.ts`. Keep `NOMINATIM_TIMEOUT_MS = 8000` as a named export (production value, do not lower it for tests):

```ts
it("maps an aborted Nominatim fetch to a 504 HttpError", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  const pending = reverseGeocodeNominatim(31, 121);
  pending.catch(() => {});
  await vi.advanceTimersByTimeAsync(8001);
  await expect(pending).rejects.toMatchObject({
    status: 504,
    message: "查找地址超时，可稍后重试或手动填写",
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/geocode/nominatim.test.ts tests/api/geocode-reverse.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/geocode/nominatim.ts app/api/geocode/reverse/route.ts tests/geocode/nominatim.test.ts tests/api/geocode-reverse.test.ts
git commit -m "feat: proxy Nominatim reverse geocode behind a logged-in API"
```

---

### Task 11: Auto-fill address from locate and pin (item 6 UI)

**Files:**
- Modify: `components/LocationField.tsx`
- Modify: `components/EntryForm.tsx`
- Modify: `tests/components/location-field-picker.test.ts`

**Interfaces:**
- Consumes: `GET /api/geocode/reverse` via `requestJson`; `onAddressResolved?: (addressText: string) => void`
- Produces: locate success and map `onChange` (click/`dragend` already the only map writes) trigger reverse; lat/lng `<input>` `onChange` does **not**. Success with non-empty `address_text` calls `onAddressResolved` (overwrites). Failure/null: status 「已定位，未能自动填入地址，可手动填写」, no callback, coords kept. Abort previous lookup. Cache by `lat.toFixed(5)+","+lng.toFixed(5)` for the component lifetime. Status strings exactly as spec. `EntryForm` passes `onAddressResolved={setAddress}`. Do not put fetch in `LocationPickerMap`. Reverse errors must **not** set `EntryForm` `error`.

- [ ] **Step 1: Write the failing tests**

Extend `tests/components/location-field-picker.test.ts`:

```ts
it("reverse-geocodes after a map pin settle and after locate, but not when typing lat", async () => {
  const onChange = vi.fn();
  const onAddressResolved = vi.fn();
  const fetchMock = vi.fn(async (url: string) => {
    expect(String(url)).toMatch(/\/api\/geocode\/reverse\?lat=31/);
    return Response.json({ address_text: "南京西路" });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback) =>
        ok({
          coords: { latitude: 31.2, longitude: 121.5, accuracy: 10 },
        } as GeolocationPosition),
    },
  });
  render(
    createElement(LocationField, {
      value: { lat: "", lng: "" },
      onChange,
      onAddressResolved,
    }),
  );
  fireEvent.click(screen.getByText("模拟点选"));
  await vi.waitFor(() =>
    expect(onAddressResolved).toHaveBeenCalledWith("南京西路"),
  );
  expect(onChange).toHaveBeenCalledWith({ lat: "31.2", lng: "121.5" });
  fetchMock.mockClear();
  onAddressResolved.mockClear();
  fireEvent.change(screen.getByLabelText("纬度（-90 至 90）"), {
    target: { value: "30" },
  });
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "获取当前位置" }));
  await vi.waitFor(() =>
    expect(onAddressResolved).toHaveBeenCalledWith("南京西路"),
  );
});

it("keeps the form usable when reverse geocode fails", async () => {
  const onAddressResolved = vi.fn();
  vi.stubGlobal("fetch", async () =>
    Response.json({ error: "暂时无法解析地址" }, { status: 502 }),
  );
  render(
    createElement(LocationField, {
      value: { lat: "", lng: "" },
      onChange: () => {},
      onAddressResolved,
    }),
  );
  fireEvent.click(screen.getByText("模拟点选"));
  expect(
    await screen.findByText("已定位，未能自动填入地址，可手动填写"),
  ).toBeTruthy();
  expect(onAddressResolved).not.toHaveBeenCalled();
});
```

The existing picker tests must keep working. Import `vi.waitFor` if not already imported.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/location-field-picker.test.ts
```

Expected: FAIL — `onAddressResolved` is ignored; no reverse fetch.

- [ ] **Step 3: Write minimal implementation**

In `LocationField`:

- Accept `onAddressResolved?: (addressText: string) => void`.
- Keep an `AbortController` ref and a `Map<string, string>` cache.
- `lookup(next: LocationValue)`:
  1. parse numbers; return if invalid
  2. setMessage 「正在查找地址…」
  3. abort previous
  4. cache hit → `onAddressResolved(cached)` + 「已填入地址，可再修改」
  5. `requestJson<{ address_text: string | null }>(\`/api/geocode/reverse?lat=${lat}&lng=${lng}\`)`
  6. if `address_text` non-empty: cache, callback, success message
  7. catch / null: 「已定位，未能自动填入地址，可手动填写」
- `locate` success: `onChange` then `void lookup(...)`.
- Map: `onChange={(next) => { onChange(next); void lookup(next); }}`.
- Lat/lng inputs: only `onChange`, never `lookup`.
- If `onAddressResolved` is undefined, skip lookup (keeps unit tests that omit it).

`EntryForm.tsx`:

```tsx
<LocationField
  value={location}
  onChange={setLocation}
  onAddressResolved={setAddress}
  required={kind === "place"}
/>
```

Do not modify `components/map/LocationPickerMap.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/location-field-picker.test.ts tests/components/entry-form-edit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/LocationField.tsx components/EntryForm.tsx tests/components/location-field-picker.test.ts
git commit -m "feat: autofill address from locate and map pin via reverse geocode"
```

---

### Task 12: PhotoPicker `existingCount` (item 7 helper)

**Files:**
- Modify: `components/PhotoPicker.tsx`
- Modify: `tests/components/photo-picker.test.ts`

**Interfaces:**
- Produces: `existingCount?: number` default `0`; `full = existingCount + value.length >= MAX_PHOTOS`; `room = MAX_PHOTOS - existingCount - value.length`. Create flow unchanged when omitted.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/photo-picker.test.ts`:

```ts
it("counts already-saved photos against the three-photo cap", () => {
  render(
    createElement(PhotoPicker, {
      value: [{ previewUrl: "blob:one", file: new File(["x"], "a.png", { type: "image/png" }), sort: 0 }],
      onChange: () => {},
      existingCount: 2,
    }),
  );
  expect(
    (screen.getByRole("button", { name: "相册" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/photo-picker.test.ts
```

Expected: FAIL — album still enabled (only pending length counted).

- [ ] **Step 3: Write minimal implementation**

Add `existingCount = 0` to props. Change:

```ts
const full = existingCount + value.length >= MAX_PHOTOS;
const room = MAX_PHOTOS - existingCount - value.length;
```

Use `room` in `addFiles` (`images.slice(0, Math.max(0, room))`). Create callers stay default 0.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/photo-picker.test.ts
```

Expected: PASS (paste / storage / three-local-photos tests too).

- [ ] **Step 5: Commit**

```bash
git add components/PhotoPicker.tsx tests/components/photo-picker.test.ts
git commit -m "feat: let PhotoPicker count already-saved photos toward the cap"
```

---

### Task 13: Edit album previews + photo delete confirm (items 7 + 2)

**Files:**
- Modify: `components/EntryPhotos.tsx`
- Test: `tests/components/entry-photos.test.ts`

**Interfaces:**
- Consumes: `ConfirmDialog`, `PhotoPicker.existingCount`, `uploadEntryPhoto`
- Produces: `pending` is `useState<PickerPhoto[]>` passed as `value`. New files upload without `revokePickerPreviews` on add. Success: drop that pending item, revoke its blob, `onChange([...saved, photo])`. Failure: pending thumb stays, alert shows, saved list unchanged. `existingCount={photos.length}`. `allowReorder={false}` unchanged. Photo delete uses dialog 删除照片 / 确定删除这张照片吗？ / 删除. Create `EntryForm` path still uses its own `photos` state — do not change it except it already got price/kind/address in earlier tasks.

- [ ] **Step 1: Write the failing test**

Create `tests/components/entry-photos.test.ts`:

```ts
// @vitest-environment jsdom
import { createElement, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const upload = vi.hoisted(() => ({
  fn: vi.fn(),
}));

vi.mock("@/lib/browser-photos", () => ({
  uploadEntryPhoto: (...args: unknown[]) => upload.fn(...args),
}));

import EntryPhotos from "@/components/EntryPhotos";
import type { EntryPhotoThumb } from "@/lib/photo-constants";

afterEach(() => {
  cleanup();
  upload.fn.mockReset();
  vi.unstubAllGlobals();
});

function Harness({
  initial = [] as EntryPhotoThumb[],
}: {
  initial?: EntryPhotoThumb[];
}) {
  const [photos, setPhotos] = useState(initial);
  return createElement(EntryPhotos, {
    entryId: "e1",
    photos,
    isOwner: true,
    storageReady: true,
    onChange: setPhotos,
  });
}

it("shows a blob preview while the upload is in flight", async () => {
  let finish: (value: EntryPhotoThumb) => void = () => {};
  upload.fn.mockImplementation(
    () =>
      new Promise<EntryPhotoThumb>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:pending-preview",
    revokeObjectURL: () => undefined,
  });
  render(createElement(Harness));
  const file = new File(["img"], "shot.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("从相册选择"), {
    target: { files: [file] },
  });
  expect(
    document.querySelector(".photo-thumb img")?.getAttribute("src"),
  ).toBe("blob:pending-preview");
  await act(async () => {
    finish({
      id: "p-new",
      public_url: "https://cdn.example/new.webp",
      sort: 0,
    });
  });
  expect(
    await screen.findByRole("img", { name: "封面照片" }),
  ).toHaveAttribute("src", "https://cdn.example/new.webp");
});

it("keeps saved photos and the pending thumb when upload fails", async () => {
  upload.fn.mockRejectedValue(new Error("照片上传失败，请重试"));
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:fail",
    revokeObjectURL: () => undefined,
  });
  render(
    createElement(Harness, {
      initial: [
        { id: "p0", public_url: "https://cdn.example/old.webp", sort: 0 },
      ],
    }),
  );
  const file = new File(["img"], "shot.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("从相册选择"), {
    target: { files: [file] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "照片上传失败，请重试",
  );
  expect(screen.getByAltText("封面照片").getAttribute("src")).toBe(
    "https://cdn.example/old.webp",
  );
  expect(document.querySelector(".photo-thumb img")?.getAttribute("src")).toBe(
    "blob:fail",
  );
});

it("does not delete a saved photo when the confirm is dismissed", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(
    createElement(Harness, {
      initial: [
        { id: "p0", public_url: "https://cdn.example/old.webp", sort: 0 },
      ],
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(screen.getByRole("dialog", { name: "删除照片" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByAltText("封面照片")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/entry-photos.test.ts
```

Expected: FAIL — constant empty `pending`, immediate revoke, `window.confirm`.

- [ ] **Step 3: Write minimal implementation**

Rewrite `components/EntryPhotos.tsx` pending handling:

```tsx
const [pending, setPending] = useState<PickerPhoto[]>([]);
const [confirmId, setConfirmId] = useState<string | null>(null);

async function handlePickerChange(next: PickerPhoto[]) {
  const previous = new Set(pending.map((photo) => photo.previewUrl));
  const added = next.filter(
    (photo) => photo.file && !previous.has(photo.previewUrl),
  );
  setPending(next);
  if (!added.length) return;
  setBusy(true);
  setError("");
  let current = photos;
  try {
    for (const item of added) {
      const photo = await uploadEntryPhoto(
        entryId,
        item.file!,
        nextPhotoSort(current),
      );
      current = [...current, photo];
      onChange(current);
      setPending((list) =>
        list.filter((row) => row.previewUrl !== item.previewUrl),
      );
      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
  } catch (e) {
    onChange(current);
    setError((e as Error).message);
  } finally {
    setBusy(false);
  }
}
```

Pass:

```tsx
<PhotoPicker
  value={pending}
  onChange={(next) => void handlePickerChange(next)}
  disabled={busy}
  storageReady={storageReady}
  allowReorder={false}
  existingCount={photos.length}
/>
```

Delete saved photo: `onClick={() => setConfirmId(photo.id)}` then `ConfirmDialog` with 删除照片 copy; `onConfirm` runs the existing DELETE. Never `window.confirm`. Never `revokePickerPreviews(next)` on add.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/entry-photos.test.ts tests/components/photo-picker.test.ts tests/components/entry-form-edit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/EntryPhotos.tsx tests/components/entry-photos.test.ts
git commit -m "fix: show edit-mode photo previews and confirm photo deletes in-app"
```

---

### Task 14: Full verification

**Files:** none new — run the suite; fix only fallout from `Entry.price` or hydration.

- [ ] **Step 1: Search leftover `window.confirm`**

```bash
rg "window\\.confirm" --glob '*.{ts,tsx}'
```

Expected: no matches under `components/` or `app/`. Tests must not stub `confirm` as the primary delete path.

- [ ] **Step 2: Run the full automated suite**

```bash
npm test
npm run lint
npx tsc --noEmit
```

Expected: all green. If `tsc` is not a project script, `npm run build` is the typecheck stand-in:

```bash
npm run build
```

Expected: PASS, no new hydration warnings.

- [ ] **Step 3: Manual browser checklist (Codex CLI / implementer)**

On the worktree dev server, with a logged-in user:

1. Multi-photo card: dots are round; current terracotta and slightly larger; click still snaps.
2. Owner card: bottom-right icons; cancel dialog does not delete; confirm deletes.
3. `/entries/new` has no 「增加记录」 heading; kind 餐饮/物品 buttons; cuisine multi-toggle; item majors full-width radios; subcategories multi.
4. Locate or drag pin fills 地址; turning off network still saves coords.
5. Edit an entry, pick from 相册, see thumb, then saved image.
6. Item price `12.5` shows 「12.5 元」 on card and detail; place has no field.

- [ ] **Step 4: Commit only if Step 2 required fixes**

```bash
git add -u
git commit -m "fix: settle remaining UX polish type and test fallout"
```

Skip this commit if the tree is already clean.

---

## Spec coverage (self-review)

| Spec item | Task |
| --- | --- |
| 5.1 round dots | Task 1 |
| 5.2 in-app confirm (list) | Tasks 2–3 |
| 5.2 detail confirm | Task 4 |
| 5.2 photo confirm | Task 13 |
| 5.3 card icons | Task 3 |
| 5.4 new-entry intro | Task 5 |
| 5.5 kind + cuisine buttons, cuisine multi | Task 6 |
| 5.6 Nominatim proxy + LocationField | Tasks 10–11 |
| 5.7 edit photo thumbs | Tasks 12–13 |
| 5.8 major category radios, leaves multi | Task 7 |
| 5.9 price column/schema/UI | Tasks 8–9 |
| China latency / no key / no Amap | Task 10 Global Constraints |
| Out of scope (map bubbles, SMS, cover reorder, foods) | File map “Do not touch” |
| Final verification | Task 14 |

## Type names (do not drift)

`ConfirmDialogProps`, `formatPrice`, `NOMINATIM_USER_AGENT`, `NOMINATIM_TIMEOUT_MS`, `formatNominatimDisplayName`, `resetNominatimGateForTests`, `reverseGeocodeNominatim`, `onAddressResolved`, `existingCount`, `Entry.price: number | null`, migration `007_entry_item_price.sql` (or next free `00N` if 007 is taken at execution time).

## Placeholders

None. No TBD / TODO / “handle edge cases later”. Reverse-geocode failure copy, dialog copy, and price error 「请输入有效价格（元，最多两位小数）」 are specified in the tasks that implement them.
