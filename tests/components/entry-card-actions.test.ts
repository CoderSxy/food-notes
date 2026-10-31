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
