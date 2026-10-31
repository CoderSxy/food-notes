// @vitest-environment jsdom
import { createElement } from "react";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const layer = vi.hoisted(() => ({
  handlers: {} as Record<string, () => void>,
  redraw: vi.fn(),
}));
vi.mock("react-leaflet", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    TileLayer: forwardRef(function Tile(
      props: { eventHandlers: Record<string, () => void> },
      ref,
    ) {
      layer.handlers = props.eventHandlers;
      useImperativeHandle(ref, () => ({ redraw: layer.redraw }));
      return null;
    }),
  };
});
import MapTileLayer from "@/components/map/MapTileLayer";
afterEach(cleanup);
it("shows a recoverable tile failure while preserving other map content", () => {
  render(
    createElement(
      "div",
      null,
      createElement("h2", {}, "记录地图"),
      createElement(MapTileLayer),
    ),
  );
  expect(screen.queryByRole("button", { name: "重试底图" })).toBeNull();
  act(() => layer.handlers.tileerror());
  expect(screen.getByText("部分底图未能加载，记录点位仍可查看。")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "记录地图" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "重试底图" }));
  expect(layer.redraw).toHaveBeenCalled();
});

it("keeps tile loading visible until the base map finishes loading", () => {
  render(createElement(MapTileLayer));
  expect(screen.getByText("底图加载中，记录点位可先查看。")).toBeTruthy();
  act(() => layer.handlers.load());
  expect(screen.queryByText("底图加载中，记录点位可先查看。")).toBeNull();
});
