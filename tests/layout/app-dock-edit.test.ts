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
