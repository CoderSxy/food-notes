export const TOKEN_KEY = "food-notes:access-token";
export const AUTH_EVENT = "food-notes:auth-changed";
export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function writeToken(token: string | null) {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* Storage unavailable. */
    }
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}
