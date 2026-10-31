import { afterEach, beforeEach, expect, it, vi } from "vitest";
const admin = vi.hoisted(() => ({ maybeSingle: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => admin }) }),
  }),
}));
import { requireUser } from "@/lib/auth/requestUser";
import { createSessionToken } from "@/lib/auth/session";
beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "a".repeat(40));
  admin.maybeSingle.mockResolvedValue({ data: { id: "me" }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("accepts a verified Bearer token and existing user", async () => {
  const token = await createSessionToken("me");
  await expect(
    requireUser(
      new Request("http://localhost/api/entries", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ),
  ).resolves.toMatchObject({ userId: "me" });
});
it("rejects missing, corrupt, and Cookie-only tokens", async () => {
  for (const headers of [
    {},
    { Authorization: "Bearer nope" },
    { Cookie: `food_session=${await createSessionToken("me")}` },
  ] as Record<string, string>[]) {
    await expect(
      requireUser(new Request("http://localhost/api/entries", { headers })),
    ).rejects.toMatchObject({ status: 401 });
  }
});
it("rejects a valid token belonging to a deleted user", async () => {
  admin.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(
    requireUser(
      new Request("http://localhost", {
        headers: { Authorization: `Bearer ${await createSessionToken("me")}` },
      }),
    ),
  ).rejects.toMatchObject({ status: 401 });
});

it("rejects an expired signed token after the 30-day session window", async () => {
  vi.useFakeTimers();
  try {
    const token = await createSessionToken("me");
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    await expect(
      requireUser(
        new Request("http://localhost/api/entries", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  } finally {
    vi.useRealTimers();
  }
});
