// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { requestJson } from "@/lib/browser";
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});
it("attaches the stored token only to same-origin API requests", async () => {
  localStorage.setItem("food-notes:access-token", "abc");
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  await requestJson("/api/entries");
  expect(new Headers(fetch.mock.calls[0][1].headers).get("authorization")).toBe(
    "Bearer abc",
  );
  await requestJson("https://example.com/api/entries");
  expect(
    new Headers(fetch.mock.calls[1][1].headers).get("authorization"),
  ).toBeNull();
});
it("preserves token on 500 and clears it on business 401", async () => {
  localStorage.setItem("food-notes:access-token", "abc");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "retry" }, { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({ error: "expired" }, { status: 401 }),
      ),
  );
  await expect(requestJson("/api/entries")).rejects.toMatchObject({
    status: 500,
  });
  expect(localStorage.getItem("food-notes:access-token")).toBe("abc");
  await expect(requestJson("/api/entries")).rejects.toMatchObject({
    status: 401,
  });
  expect(localStorage.getItem("food-notes:access-token")).toBeNull();
});

it("discards an old-account response after the token changes", async () => {
  localStorage.setItem("food-notes:access-token", "old-account");
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const request = requestJson("/api/entries");
  localStorage.setItem("food-notes:access-token", "new-account");
  finish(Response.json({ entries: [{ name: "old private response" }] }));
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
});
it("does not clear a new-account token when an old-account request returns 401", async () => {
  localStorage.setItem("food-notes:access-token", "old-account");
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const request = requestJson("/api/entries");
  localStorage.setItem("food-notes:access-token", "new-account");
  finish(Response.json({ error: "expired" }, { status: 401 }));
  await expect(request).rejects.toMatchObject({ status: 401 });
  expect(localStorage.getItem("food-notes:access-token")).toBe("new-account");
});
