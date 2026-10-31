// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

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
