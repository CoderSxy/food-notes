import { readToken, writeToken } from "@/lib/auth/token-store";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const target = new URL(
    url,
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
  );
  const localApi =
    typeof window !== "undefined" &&
    target.origin === window.location.origin &&
    target.pathname.startsWith("/api/");
  const headers = new Headers(init?.headers);
  const token = localApi ? readToken() : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const data = await response
    .json()
    .catch(() => ({ error: "服务响应异常，请重试" }));
  if (!response.ok) {
    if (
      localApi &&
      response.status === 401 &&
      !/^\/api\/auth\/(login|verify-otp|send-otp)$/.test(target.pathname) &&
      token === readToken()
    )
      writeToken(null);
    throw new ApiError(data.error || "请求失败，请重试", response.status);
  }
  // A request started under an old account must never publish its result.
  if (localApi && token !== readToken())
    throw new DOMException("登录状态已变化", "AbortError");
  return data as T;
}
export function jsonBody(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}
