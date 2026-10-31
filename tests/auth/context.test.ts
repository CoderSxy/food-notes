// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { AuthProvider, useAuth } from "@/lib/auth/context";
import { TOKEN_KEY } from "@/lib/auth/token-store";
function Content() {
  const auth = useAuth();
  return auth.status === "signed-in"
    ? createElement("input", { "aria-label": "draft", defaultValue: "" })
    : createElement("p", {}, auth.status);
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
it("preserves an unfinished form during background session checks and transient failures", async () => {
  localStorage.setItem(TOKEN_KEY, "token");
  let finish: ((r: Response) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ user: { userId: "me" } }))
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            finish = r;
          }),
      ),
  );
  render(createElement(AuthProvider, null, createElement(Content)));
  const input = await screen.findByRole("textbox", { name: "draft" });
  fireEvent.change(input, { target: { value: "尚未保存" } });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(screen.getByRole("textbox", { name: "draft" })).toBe(input);
  await act(async () => {
    finish!(Response.json({ error: "temporary" }, { status: 500 }));
  });
  await waitFor(() =>
    expect(
      (screen.getByRole("textbox", { name: "draft" }) as HTMLInputElement)
        .value,
    ).toBe("尚未保存"),
  );
});
it("hides old account content immediately when another tab replaces the token", async () => {
  localStorage.setItem(TOKEN_KEY, "token");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ user: { userId: "me" } }))
      .mockImplementation(() => new Promise(() => {})),
  );
  render(createElement(AuthProvider, null, createElement(Content)));
  await screen.findByRole("textbox");
  await act(async () => {
    localStorage.setItem(TOKEN_KEY, "other");
    window.dispatchEvent(
      new StorageEvent("storage", { key: TOKEN_KEY, newValue: "other" }),
    );
  });
  expect(screen.queryByRole("textbox")).toBeNull();
});
