import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as null | { userId: string },
  getEntry: vi.fn(),
  countPhotos: vi.fn(),
  insertPhoto: vi.fn(),
  getPhoto: vi.fn(),
  deletePhotoRow: vi.fn(),
  isR2Configured: vi.fn(),
  presignPutObject: vi.fn(),
  publicUrlForKey: vi.fn(),
  deleteR2Object: vi.fn(),
}));

vi.mock("@/lib/auth/requestUser", () => ({
  requireUser: async () => {
    if (!mocks.user) {
      const { HttpError } = await import("@/lib/http");
      throw new HttpError("请先登录", 401);
    }
    return mocks.user;
  },
}));
vi.mock("@/lib/entries", () => ({ getEntry: mocks.getEntry }));
vi.mock("@/lib/photos", async () => {
  const actual = await vi.importActual<typeof import("@/lib/photos")>(
    "@/lib/photos",
  );
  return {
    ...actual,
    countPhotos: mocks.countPhotos,
    insertPhoto: mocks.insertPhoto,
    getPhoto: mocks.getPhoto,
    deletePhotoRow: mocks.deletePhotoRow,
  };
});
vi.mock("@/lib/r2", () => ({
  isR2Configured: mocks.isR2Configured,
  presignPutObject: mocks.presignPutObject,
  publicUrlForKey: mocks.publicUrlForKey,
  deleteR2Object: mocks.deleteR2Object,
}));

import { GET as status } from "@/app/api/photos/status/route";
import { POST as presign } from "@/app/api/photos/presign/route";
import { POST as confirm } from "@/app/api/photos/confirm/route";
import { DELETE as remove } from "@/app/api/photos/[id]/route";

const entryId = "11111111-1111-4111-8111-111111111111";
const photoId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

function req(path: string, body?: unknown, method = "POST") {
  return new Request(`http://localhost/api/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
  mocks.isR2Configured.mockReturnValue(true);
  mocks.getEntry.mockResolvedValue({ id: entryId, user_id: userId });
  mocks.countPhotos.mockResolvedValue(0);
  mocks.presignPutObject.mockResolvedValue("https://r2.example/upload");
  mocks.publicUrlForKey.mockImplementation(
    (key: string) => `https://cdn.example/${key}`,
  );
  vi.spyOn(crypto, "randomUUID").mockReturnValue(photoId);
});

describe("photo APIs", () => {
  it("requires auth before touching storage", async () => {
    expect((await status(req("photos/status", undefined, "GET"))).status).toBe(
      401,
    );
    expect(
      (await presign(req("photos/presign", { entryId }))).status,
    ).toBe(401);
    expect(mocks.getEntry).not.toHaveBeenCalled();
  });

  it("returns 503 when R2 is not configured", async () => {
    mocks.user = { userId };
    mocks.isR2Configured.mockReturnValue(false);
    const response = await presign(
      req("photos/presign", {
        entryId,
        contentType: "image/webp",
        bytes: 100,
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "图片存储未配置" });
    expect(mocks.presignPutObject).not.toHaveBeenCalled();
  });

  it("reports storage status for signed-in users", async () => {
    mocks.user = { userId };
    expect(
      await (await status(req("photos/status", undefined, "GET"))).json(),
    ).toEqual({ configured: true });
  });

  it("forbids presign for another user's entry", async () => {
    mocks.user = { userId };
    mocks.getEntry.mockResolvedValue({ id: entryId, user_id: "other" });
    expect(
      (
        await presign(
          req("photos/presign", {
            entryId,
            contentType: "image/jpeg",
            bytes: 100,
          }),
        )
      ).status,
    ).toBe(403);
    expect(mocks.presignPutObject).not.toHaveBeenCalled();
  });

  it("rejects a fourth photo", async () => {
    mocks.user = { userId };
    mocks.countPhotos.mockResolvedValue(3);
    const response = await presign(
      req("photos/presign", {
        entryId,
        contentType: "image/png",
        bytes: 100,
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "最多 3 张照片" });
  });

  it("issues a presigned put for the owner", async () => {
    mocks.user = { userId };
    const response = await presign(
      req("photos/presign", {
        entryId,
        contentType: "image/webp",
        bytes: 900_000,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      uploadUrl: "https://r2.example/upload",
      r2Key: `entries/${userId}/${entryId}/${photoId}.webp`,
      publicUrl: `https://cdn.example/entries/${userId}/${entryId}/${photoId}.webp`,
      photoId,
      headers: { "Content-Type": "image/webp" },
    });
    expect(mocks.presignPutObject).toHaveBeenCalledWith(
      `entries/${userId}/${entryId}/${photoId}.webp`,
      "image/webp",
      900_000,
    );
  });

  it("rejects confirm when the key is not owned", async () => {
    mocks.user = { userId };
    const response = await confirm(
      req("photos/confirm", {
        entryId,
        photoId,
        r2Key: "entries/other/e/p.webp",
        publicUrl: "https://cdn.example/x.webp",
        sort: 0,
        contentType: "image/webp",
        bytes: 100,
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.insertPhoto).not.toHaveBeenCalled();
  });

  it("inserts a confirmed photo for the owner", async () => {
    mocks.user = { userId };
    const photo = { id: photoId, entry_id: entryId, sort: 1 };
    mocks.insertPhoto.mockResolvedValue(photo);
    const r2Key = `entries/${userId}/${entryId}/${photoId}.jpg`;
    const response = await confirm(
      req("photos/confirm", {
        entryId,
        photoId,
        r2Key,
        publicUrl: `https://cdn.example/${r2Key}`,
        sort: 1,
        contentType: "image/jpeg",
        bytes: 100,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ photo });
    expect(mocks.insertPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: photoId,
        entry_id: entryId,
        user_id: userId,
        r2_key: r2Key,
        sort: 1,
      }),
    );
  });

  it("stores the server-derived public url even if the client sends another", async () => {
    mocks.user = { userId };
    const r2Key = `entries/${userId}/${entryId}/${photoId}.jpg`;
    const derived = `https://cdn.example/${r2Key}`;
    mocks.insertPhoto.mockImplementation(async (row) => row);
    const response = await confirm(
      req("photos/confirm", {
        entryId,
        photoId,
        r2Key,
        publicUrl: "https://evil.example/phish.webp",
        sort: 0,
        contentType: "image/jpeg",
        bytes: 100,
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.publicUrlForKey).toHaveBeenCalledWith(r2Key);
    expect(mocks.insertPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ public_url: derived }),
    );
    expect(mocks.insertPhoto).not.toHaveBeenCalledWith(
      expect.objectContaining({
        public_url: "https://evil.example/phish.webp",
      }),
    );
  });

  it("rejects confirm when the entry already has 3 photos", async () => {
    mocks.user = { userId };
    mocks.countPhotos.mockResolvedValue(3);
    const r2Key = `entries/${userId}/${entryId}/${photoId}.webp`;
    const response = await confirm(
      req("photos/confirm", {
        entryId,
        photoId,
        r2Key,
        publicUrl: `https://cdn.example/${r2Key}`,
        sort: 0,
        contentType: "image/webp",
        bytes: 100,
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "最多 3 张照片" });
    expect(mocks.insertPhoto).not.toHaveBeenCalled();
  });

  it("forbids deleting another user's photo", async () => {
    mocks.user = { userId };
    mocks.getPhoto.mockResolvedValue({
      id: photoId,
      user_id: "other",
      r2_key: "k",
    });
    expect(
      (
        await remove(req(`photos/${photoId}`, undefined, "DELETE"), {
          params: Promise.resolve({ id: photoId }),
        })
      ).status,
    ).toBe(403);
    expect(mocks.deletePhotoRow).not.toHaveBeenCalled();
  });

  it("deletes the row and best-effort removes the object", async () => {
    mocks.user = { userId };
    mocks.getPhoto.mockResolvedValue({
      id: photoId,
      user_id: userId,
      r2_key: "k",
    });
    mocks.deletePhotoRow.mockResolvedValue({
      id: photoId,
      user_id: userId,
      r2_key: "k",
    });
    const response = await remove(
      req(`photos/${photoId}`, undefined, "DELETE"),
      { params: Promise.resolve({ id: photoId }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.deleteR2Object).toHaveBeenCalledWith("k");
  });
});
