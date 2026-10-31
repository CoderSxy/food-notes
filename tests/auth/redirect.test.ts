import { expect, it } from "vitest";
import { safeNext } from "@/lib/auth/redirect";
it("keeps valid local paths and filters encoded external redirects and login loops", () => {
  expect(safeNext("/entries?scope=all&kind=item")).toBe(
    "/entries?scope=all&kind=item",
  );
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/%2fevil.test",
    "/%5cevil.test",
    "/%252fevil.test",
    "/login?next=/",
    "/\\evil.test",
    "/api/auth/me",
    "/entries/../login",
    "/%2e/login",
    "/entries/../api/auth/me",
  ])
    expect(safeNext(path)).toBe("/");
});
