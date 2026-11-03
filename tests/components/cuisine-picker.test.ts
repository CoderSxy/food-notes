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
