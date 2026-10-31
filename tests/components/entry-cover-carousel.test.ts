// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
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
