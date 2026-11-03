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
