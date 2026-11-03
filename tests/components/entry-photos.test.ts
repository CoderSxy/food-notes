// @vitest-environment jsdom
import { createElement, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const upload = vi.hoisted(() => ({
  fn: vi.fn(),
}));

vi.mock("@/lib/browser-photos", () => ({
  uploadEntryPhoto: (...args: unknown[]) => upload.fn(...args),
}));

import EntryPhotos from "@/components/EntryPhotos";
import type { EntryPhotoThumb } from "@/lib/photo-constants";

afterEach(() => {
  cleanup();
  upload.fn.mockReset();
  vi.unstubAllGlobals();
});

function Harness({
  initial = [] as EntryPhotoThumb[],
}: {
  initial?: EntryPhotoThumb[];
}) {
  const [photos, setPhotos] = useState(initial);
  return createElement(EntryPhotos, {
    entryId: "e1",
    photos,
    isOwner: true,
    storageReady: true,
    onChange: setPhotos,
  });
}

it("shows a blob preview while the upload is in flight", async () => {
  let finish: (value: EntryPhotoThumb) => void = () => {};
  upload.fn.mockImplementation(
    () =>
      new Promise<EntryPhotoThumb>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:pending-preview",
    revokeObjectURL: () => undefined,
  });
  render(createElement(Harness));
  const file = new File(["img"], "shot.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("从相册选择"), {
    target: { files: [file] },
  });
  expect(
    document.querySelector(".photo-thumb img")?.getAttribute("src"),
  ).toBe("blob:pending-preview");
  await act(async () => {
    finish({
      id: "p-new",
      public_url: "https://cdn.example/new.webp",
      sort: 0,
    });
  });
  expect(
    await screen.findByRole("img", { name: "封面照片" }),
  ).toHaveAttribute("src", "https://cdn.example/new.webp");
});

it("keeps saved photos and the pending thumb when upload fails", async () => {
  upload.fn.mockRejectedValue(new Error("照片上传失败，请重试"));
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:fail",
    revokeObjectURL: () => undefined,
  });
  render(
    createElement(Harness, {
      initial: [
        { id: "p0", public_url: "https://cdn.example/old.webp", sort: 0 },
      ],
    }),
  );
  const file = new File(["img"], "shot.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("从相册选择"), {
    target: { files: [file] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "照片上传失败，请重试",
  );
  expect(screen.getByAltText("封面照片").getAttribute("src")).toBe(
    "https://cdn.example/old.webp",
  );
  expect(document.querySelector(".photo-thumb img")?.getAttribute("src")).toBe(
    "blob:fail",
  );
});

it("does not delete a saved photo when the confirm is dismissed", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(
    createElement(Harness, {
      initial: [
        { id: "p0", public_url: "https://cdn.example/old.webp", sort: 0 },
      ],
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(screen.getByRole("dialog", { name: "删除照片" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByAltText("封面照片")).toBeTruthy();
});
