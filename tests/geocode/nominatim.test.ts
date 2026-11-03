import { afterEach, expect, it, vi } from "vitest";
import {
  formatNominatimDisplayName,
  NOMINATIM_USER_AGENT,
  resetNominatimGateForTests,
  reverseGeocodeNominatim,
} from "@/lib/geocode/nominatim";

afterEach(() => {
  resetNominatimGateForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("trims and caps display_name at 300 characters", () => {
  expect(formatNominatimDisplayName("  南京  西路  ")).toBe("南京 西路");
  expect(formatNominatimDisplayName("")).toBeNull();
  expect(formatNominatimDisplayName("x".repeat(301))?.length).toBe(300);
});

it("calls Nominatim with lon, zh-CN, and the food-notes user agent", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    expect(url).toContain("nominatim.openstreetmap.org/reverse");
    expect(url).toContain("lon=121.5");
    expect(url).not.toContain("lng=");
    expect(url).toContain("format=jsonv2");
    expect(url).toContain("accept-language=zh-CN");
    expect(init?.headers).toMatchObject({
      "User-Agent": NOMINATIM_USER_AGENT,
      Accept: "application/json",
    });
    expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/Authorization/i);
    return Response.json({ display_name: "南京西路, 上海" });
  });
  vi.stubGlobal("fetch", fetchMock);
  await expect(reverseGeocodeNominatim(31.2, 121.5)).resolves.toEqual({
    address_text: "南京西路, 上海",
  });
  expect(NOMINATIM_USER_AGENT).toContain("food-notes");
  expect(NOMINATIM_USER_AGENT).toContain("food.nerosun.cn");
});

it("maps an aborted Nominatim fetch to a 504 HttpError", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  const pending = reverseGeocodeNominatim(31, 121);
  pending.catch(() => {});
  await vi.advanceTimersByTimeAsync(8001);
  await expect(pending).rejects.toMatchObject({
    status: 504,
    message: "查找地址超时，可稍后重试或手动填写",
  });
});
