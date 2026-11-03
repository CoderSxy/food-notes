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
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "取消" }),
  );
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
