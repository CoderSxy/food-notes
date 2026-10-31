/** Only local application destinations may be used after signing in. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  let decoded = value;
  for (let i = 0; i < 5; i++) {
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      /[\\\u0000-\u0020]/.test(decoded)
    )
      return "/";
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return "/";
    }
  }
  if (/%[0-9a-f]{2}/i.test(decoded)) return "/";
  const path = new URL(decoded, "https://local.invalid").pathname;
  if (/^\/(login|api)(\/|$)/.test(path)) return "/";
  return value;
}
