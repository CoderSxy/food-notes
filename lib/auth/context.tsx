"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { requestJson, jsonBody } from "@/lib/browser";
import { AUTH_EVENT, TOKEN_KEY, readToken, writeToken } from "./token-store";
export type AuthUser = {
  userId: string;
  username?: string | null;
  nickname?: string | null;
  phone?: string | null;
};
type AuthStatus = "loading" | "signed-in" | "signed-out" | "error";
type AuthState = { user: AuthUser | null; status: AuthStatus; error: string };
const initial: AuthState = { user: null, status: "loading", error: "" };
const AuthContext = createContext<
  | (AuthState & {
      retry: () => Promise<void>;
      login: (token: string) => Promise<void>;
      logout: () => Promise<void>;
    })
  | null
>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initial);
  const generation = useRef(0);
  const verifiedToken = useRef<string | null>(null);
  const refresh = useCallback(async (background = false) => {
    const seq = ++generation.current;
    const token = readToken();
    if (!token) {
      verifiedToken.current = null;
      setState({ user: null, status: "signed-out", error: "" });
      return;
    }
    const keepContent = background && token === verifiedToken.current;
    if (!keepContent) setState({ user: null, status: "loading", error: "" });
    try {
      const { user } = await requestJson<{ user: AuthUser }>("/api/auth/me");
      if (seq === generation.current) {
        verifiedToken.current = token;
        setState({ user, status: "signed-in", error: "" });
      }
    } catch (error) {
      if (seq !== generation.current) return;
      if (keepContent && readToken() === token)
        setState((previous) => ({
          ...previous,
          error: "登录状态暂时无法复核，可稍后重试",
        }));
      else
        setState({
          user: null,
          status: readToken() ? "error" : "signed-out",
          error: readToken() ? (error as Error).message : "",
        });
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY || e.key === null) void refresh();
    };
    const onAuth = () => {
      void refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_EVENT, onAuth);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      // Invalidates asynchronous verification; this ref is a request generation, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_EVENT, onAuth);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  useEffect(() => {
    if (state.status !== "signed-in") return;
    let timer: ReturnType<typeof setTimeout>;
    try {
      const payload = JSON.parse(
        atob(readToken()!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      const delay = payload.exp * 1000 - Date.now();
      const check = () => {
        if (payload.exp * 1000 <= Date.now()) writeToken(null);
        else
          timer = setTimeout(
            check,
            Math.min(payload.exp * 1000 - Date.now(), 2147483647),
          );
      };
      timer = setTimeout(check, Math.max(0, Math.min(delay, 2147483647)));
    } catch {
      return;
    }
    return () => clearTimeout(timer);
  }, [state.status]);
  const login = useCallback(
    async (token: string) => {
      writeToken(token);
      await refresh();
    },
    [refresh],
  );
  const logout = useCallback(async () => {
    // Local logout must work even offline; no copied JWT revocation is implied.
    const token = readToken();
    try {
      await requestJson("/api/auth/logout", jsonBody({}));
    } finally {
      if (readToken() === token) writeToken(null);
    }
  }, []);
  return (
    <AuthContext.Provider
      value={{ ...state, retry: () => refresh(true), login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return (
    useContext(AuthContext) ?? {
      ...initial,
      retry: async () => {},
      login: async () => {},
      logout: async () => {},
    }
  );
}
