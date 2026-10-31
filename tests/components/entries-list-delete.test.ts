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
