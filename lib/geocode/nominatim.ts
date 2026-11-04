import dns from "node:dns";
import http from "node:http";
import tls from "node:tls";
import { HttpError } from "@/lib/http";

// Hangzhou ECS often cannot reach nominatim.openstreetmap.org (GFW / broken IPv6).
// Prefer IPv4, allow NOMINATIM_BASE_URL or an HTTP CONNECT proxy (NOMINATIM_PROXY).

export const NOMINATIM_USER_AGENT =
  "food-notes/1.0 (https://food.nerosun.cn; reverse-geocode)";
export const NOMINATIM_TIMEOUT_MS = 8000;
const NOMINATIM_REFERER = "https://food.nerosun.cn/";
const DEFAULT_NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const MIN_INTERVAL_MS = 1000;
const CONNECT_FAIL_CODES = new Set([
  "ETIMEDOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

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

function nominatimHeaders(): Record<string, string> {
  return {
    "User-Agent": NOMINATIM_USER_AGENT,
    Accept: "application/json",
    Referer: NOMINATIM_REFERER,
  };
}

function nominatimReverseUrl(lat: number, lng: number): URL {
  const raw =
    process.env.NOMINATIM_BASE_URL?.trim() || DEFAULT_NOMINATIM_BASE_URL;
  const base = raw.replace(/\/+$/, "");
  const url = new URL(`${base}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", "zh-CN");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "0");
  return url;
}

function readNominatimProxy(): URL | "invalid" | null {
  const raw = process.env.NOMINATIM_PROXY?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:") return "invalid";
    return url;
  } catch {
    return "invalid";
  }
}

function errorCode(error: unknown): string {
  let current: unknown = error;
  for (let i = 0; i < 4 && current && typeof current === "object"; i += 1) {
    if ("code" in current && current.code != null) return String(current.code);
    current = "cause" in current ? current.cause : undefined;
  }
  return "";
}

function connectFailure(): HttpError {
  return new HttpError("暂时无法连接地址查询服务，可手动填写", 502);
}

function abortError(): Error {
  return Object.assign(new Error("timeout"), { name: "AbortError" });
}

function proxyHttpsGet(
  url: URL,
  proxy: URL,
  headers: Record<string, string>,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let tlsSocket: tls.TLSSocket | undefined;
    const proxyHeaders: http.OutgoingHttpHeaders = {
      Host: `${url.hostname}:443`,
    };
    if (proxy.username || proxy.password) {
      const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
      proxyHeaders["Proxy-Authorization"] =
        `Basic ${Buffer.from(auth).toString("base64")}`;
    }
    const proxyReq = http.request({
      hostname: proxy.hostname,
      port: Number(proxy.port || 80),
      method: "CONNECT",
      path: `${url.hostname}:443`,
      headers: proxyHeaders,
      family: 4,
    });
    const finish = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      proxyReq.destroy();
      tlsSocket?.destroy();
      reject(error);
    };
    const onAbort = () => finish(abortError());
    const timer = setTimeout(() => finish(abortError()), timeoutMs);
    signal.addEventListener("abort", onAbort, { once: true });
    proxyReq.setTimeout(timeoutMs, () => finish(abortError()));
    proxyReq.on("error", finish);
    proxyReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        finish(connectFailure());
        return;
      }
      tlsSocket = tls.connect({
        socket,
        servername: url.hostname,
        timeout: timeoutMs,
      });
      tlsSocket.once("error", finish);
      tlsSocket.once("secureConnect", () => {
        const req = http.request(
          {
            host: url.hostname,
            path: `${url.pathname}${url.search}`,
            method: "GET",
            headers: { ...headers, Host: url.hostname },
            timeout: timeoutMs,
            createConnection: () => tlsSocket as tls.TLSSocket,
          },
          (upstream) => {
            const chunks: Buffer[] = [];
            upstream.on("data", (chunk) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            upstream.on("end", () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              signal.removeEventListener("abort", onAbort);
              resolve(
                new Response(Buffer.concat(chunks), {
                  status: upstream.statusCode || 0,
                  headers: { "Content-Type": "application/json" },
                }),
              );
            });
          },
        );
        req.on("error", finish);
        req.on("timeout", () => {
          req.destroy();
          finish(abortError());
        });
        req.end();
      });
    });
    proxyReq.end();
  });
}

async function nominatimGet(
  url: URL,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<Response> {
  const headers = nominatimHeaders();
  const proxy = readNominatimProxy();
  if (proxy === "invalid") throw connectFailure();
  if (proxy) return proxyHttpsGet(url, proxy, headers, timeoutMs, signal);
  return fetch(url, {
    headers,
    signal,
    cache: "no-store",
  });
}

async function fetchNominatim(
  lat: number,
  lng: number,
  timeoutMs: number,
): Promise<{ address_text: string | null }> {
  const url = nominatimReverseUrl(lat, lng);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(abortError());
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      nominatimGet(url, timeoutMs, controller.signal),
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
    if (CONNECT_FAIL_CODES.has(errorCode(error))) throw connectFailure();
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
