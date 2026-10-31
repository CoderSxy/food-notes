// @vitest-environment jsdom
import { createElement, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PhotoPicker, { type PickerPhoto } from "@/components/PhotoPicker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness({
  initial = [],
  storageReady = true,
}: {
  initial?: PickerPhoto[];
  storageReady?: boolean;
}) {
  const [value, onChange] = useState(initial);
  return createElement(PhotoPicker, { value, onChange, storageReady });
}

it("disables add controls when three photos are present", () => {
  render(
    createElement(Harness, {
      initial: [
        { previewUrl: "a", sort: 0 },
        { previewUrl: "b", sort: 1 },
        { previewUrl: "c", sort: 2 },
      ],
    }),
  );
  expect((screen.getByLabelText("从相册选择") as HTMLInputElement).disabled).toBe(
    true,
  );
  expect((screen.getByLabelText("拍照") as HTMLInputElement).disabled).toBe(true);
  expect(
    (screen.getByRole("button", { name: "相册" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

it("shows a storage warning and disables add when R2 is unset", () => {
  render(createElement(Harness, { storageReady: false }));
  expect(screen.getByText("图片存储未配置")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "相册" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

it("ignores a non-image paste and explains the problem", () => {
  render(createElement(Harness));
  const file = new File(["plain"], "note.txt", { type: "text/plain" });
  fireEvent.paste(screen.getByText("照片（选填，最多 3 张）").closest(".photo-picker")!, {
    clipboardData: { files: [file] },
  });
  expect(screen.getByRole("alert").textContent).toBe("请粘贴图片");
});

it("adds a pasted image to the picker", () => {
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:preview",
    revokeObjectURL: () => undefined,
  });
  render(createElement(Harness));
  const file = new File(["img"], "shot.png", { type: "image/png" });
  fireEvent.paste(document.querySelector(".photo-picker")!, {
    clipboardData: { files: [file] },
  });
  expect(document.querySelector(".photo-thumb img")?.getAttribute("src")).toBe(
    "blob:preview",
  );
});
