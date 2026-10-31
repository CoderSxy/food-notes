import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: null as null | { userId: string },
  summary: vi.fn(),
  map: vi.fn(),
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
vi.mock("@/lib/entries", () => ({
  getEntrySummary: mocks.summary,
  listMapPoints: mocks.map,
}));
import { GET as summary } from "@/app/api/dashboard/summary/route";
import { GET as map } from "@/app/api/entries/map/route";
const req = (query = "") =>
  new Request("http://localhost/api/dashboard/summary" + query);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it("protects both dashboard endpoints before accessing records", async () => {
  expect((await summary(req())).status).toBe(401);
  expect((await map(req())).status).toBe(401);
  expect(mocks.summary).not.toHaveBeenCalled();
  expect(mocks.map).not.toHaveBeenCalled();
});
it("defaults to authenticated user scope and marks summary private", async () => {
  mocks.user = { userId: "me" };
  mocks.summary.mockResolvedValue({
    scope: "mine",
    placeCount: 140,
    itemCount: 80,
    mappedPlaceCount: 140,
    mappedItemCount: 60,
  });
  const response = await summary(req());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.summary).toHaveBeenCalledWith("me", "mine");
});
it("rejects invalid scope or cursor before issuing a data query", async () => {
  mocks.user = { userId: "me" };
  expect((await summary(req("?scope=other"))).status).toBe(400);
  expect((await map(req("?cursor=bad"))).status).toBe(400);
  expect(mocks.summary).not.toHaveBeenCalled();
  expect(mocks.map).not.toHaveBeenCalled();
});
it("serves the explicit shared map with validated filters", async () => {
  mocks.user = { userId: "me" };
  mocks.map.mockResolvedValue({ points: [], nextCursor: null, hasMore: false });
  const response = await map(req("?scope=all&kind=item"));
  expect(response.status).toBe(200);
  expect(mocks.map).toHaveBeenCalledWith("me", {
    scope: "all",
    kind: "item",
    after: undefined,
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
