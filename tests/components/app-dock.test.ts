// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/entries/new" }));
import AppDock from "@/components/layout/AppDock";
afterEach(cleanup);
it("provides five entries, identifies the new-record page and supports Escape", () => {
  render(createElement(AppDock));
  expect(screen.getAllByRole("link")).toHaveLength(5);
  expect(
    screen.getByRole("link", { name: "增加" }).getAttribute("aria-current"),
  ).toBe("page");
  const toggle = screen.getByRole("button", { name: "展开菜单" });
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
});

it("does not steal form focus when Escape is pressed while the menu is closed", () => {
  render(
    createElement(
      "div",
      null,
      createElement("input", { "aria-label": "form field" }),
      createElement(AppDock),
    ),
  );
  const input = screen.getByRole("textbox");
  input.focus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(document.activeElement).toBe(input);
});

it("focuses the first available navigation item when opening the mobile menu", () => {
  render(createElement(AppDock));
  fireEvent.click(screen.getByRole("button", { name: "展开菜单" }));
  expect(document.activeElement).toBe(
    screen.getByRole("link", { name: "首页" }),
  );
});
