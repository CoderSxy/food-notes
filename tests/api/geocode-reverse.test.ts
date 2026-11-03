import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as null | { userId: string },
  reverse: vi.fn(),
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
vi.mock("@/lib/geocode/nominatim", () => ({
  reverseGeocodeNominatim: mocks.reverse,
}));

import { GET } from "@/app/api/geocode/reverse/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
});

const req = (query: string) =>
  new Request(`http://localhost/api/geocode/reverse?${query}`);

it("requires auth before calling Nominatim", async () => {
  expect((await GET(req("lat=31&lng=121"))).status).toBe(401);
  expect(mocks.reverse).not.toHaveBeenCalled();
});

it("rejects invalid coordinates", async () => {
  mocks.user = { userId: "u" };
  expect((await GET(req("lat=91&lng=121"))).status).toBe(400);
  expect((await GET(req(""))).status).toBe(400);
  expect(mocks.reverse).not.toHaveBeenCalled();
});

it("returns address_text from the helper", async () => {
  mocks.user = { userId: "u" };
  mocks.reverse.mockResolvedValue({ address_text: "南京西路" });
  const response = await GET(req("lat=31.2&lng=121.5"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ address_text: "南京西路" });
  expect(mocks.reverse).toHaveBeenCalledWith(31.2, 121.5);
});

it("maps helper HttpError status", async () => {
  mocks.user = { userId: "u" };
  const { HttpError } = await import("@/lib/http");
  mocks.reverse.mockRejectedValue(
    new HttpError("查找地址超时，可稍后重试或手动填写", 504),
  );
  expect((await GET(req("lat=31&lng=121"))).status).toBe(504);
});
