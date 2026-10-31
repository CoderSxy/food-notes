"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth/context";
import AppDock from "./AppDock";
import Icon from "./Icon";
function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, error, retry } = useAuth();
  const isLogin = pathname === "/login";
  useEffect(() => {
    if (!isLogin && status === "signed-out")
      router.replace(
        "/login?next=" +
          encodeURIComponent(window.location.pathname + window.location.search),
      );
  }, [isLogin, status, router]);
  if (isLogin)
    return (
      <main className="auth-main">
        <Link href="/" className="auth-brand">
          <Icon name="pin" size={27} />
          美食地图
        </Link>
        {children}
        <p className="auth-caption">记录喜欢的味道与日常</p>
      </main>
    );
  if (status !== "signed-in")
    return (
      <main className="session-screen" aria-busy={status === "loading"}>
        <Icon name="pin" size={32} />
        <h1>美食地图</h1>
        {status === "error" ? (
          <>
            <p role="alert" className="error">
              {error}
            </p>
            <button onClick={() => void retry()}>重试登录验证</button>
          </>
        ) : (
          <p role="status">正在验证登录状态…</p>
        )}
      </main>
    );
  return (
    <div className="app-shell" key={user?.userId}>
      <header className="app-header">
        <Link href="/" className="app-brand">
          <Icon name="pin" size={25} />
          <span>美食地图</span>
        </Link>
        <Link className="user-chip" href="/account">
          <span className="avatar">
            {(user?.nickname || user?.username || "我").slice(0, 1)}
          </span>
          <span>{user?.nickname || user?.username || "我的账号"}</span>
        </Link>
      </header>
      <main className="app-main">
        {error && (
          <div className="inline-error" role="status">
            {error}
            <button className="secondary" onClick={() => void retry()}>
              重试验证
            </button>
          </div>
        )}
        {children}
      </main>
      <AppDock key={pathname} />
    </div>
  );
}
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
