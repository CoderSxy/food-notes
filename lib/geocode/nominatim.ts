import { HttpError } from "@/lib/http";

export const NOMINATIM_USER_AGENT =
  "food-notes/1.0 (https://food.nerosun.cn; reverse-geocode)";
export const NOMINATIM_TIMEOUT_MS = 8000;
const MIN_INTERVAL_MS = 1000;

let lastStartedAt = 0;
let gate: Promise<unknown> = Promise.resolve();

export function resetNominatimGateForTests() {
  lastStartedAt = 0;
  gate = Promise.resolve();
}

export function formatNominatimDisplayName(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.slice(0, 300);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchNominatim(
  lat: number,
  lng: number,
  timeoutMs: number,
): Promise<{ address_text: string | null }> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", "zh-CN");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "0");

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("timeout"), { name: "AbortError" }));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      fetch(url, {
        headers: {
          "User-Agent": NOMINATIM_USER_AGENT,
          Accept: "application/json",
        },
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (response.status === 429) {
      throw new HttpError("地址查询过于频繁，请稍后再试", 429);
    }
    if (!response.ok) {
      throw new HttpError("暂时无法解析地址", 502);
    }
    const body = (await response.json().catch(() => null)) as {
      display_name?: unknown;
    } | null;
    if (!body || typeof body !== "object") {
      throw new HttpError("暂时无法解析地址", 502);
    }
    const display =
      typeof body.display_name === "string" ? body.display_name : null;
    return { address_text: formatNominatimDisplayName(display) };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) {
      throw new HttpError("查找地址超时，可稍后重试或手动填写", 504);
    }
    const name =
      typeof error === "object" && error && "name" in error
        ? String(error.name)
        : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new HttpError("查找地址超时，可稍后重试或手动填写", 504);
    }
    throw new HttpError("暂时无法解析地址", 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
): Promise<{ address_text: string | null }> {
  const deadline = Date.now() + NOMINATIM_TIMEOUT_MS;
  const run = async () => {
    const waitMs = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastStartedAt));
    if (Date.now() + waitMs >= deadline) {
      throw new HttpError("地址查询过于频繁，请稍后再试", 429);
    }
    if (waitMs > 0) await wait(waitMs);
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new HttpError("地址查询过于频繁，请稍后再试", 429);
    }
    lastStartedAt = Date.now();
    return fetchNominatim(lat, lng, remaining);
  };
  const pending = gate.then(run, run);
  gate = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}
