"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson, jsonBody } from "@/lib/browser";
import { useAuth } from "@/lib/auth/context";
import { safeNext } from "@/lib/auth/redirect";

type Mode = "password" | "otp";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { status, error, retry, login } = useAuth();
  const signedIn = status === "signed-in";

  useEffect(() => {
    if (signedIn)
      router.replace(
        safeNext(new URLSearchParams(window.location.search).get("next")),
      );
  }, [signedIn, router]);

  async function loginPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await requestJson<{ accessToken: string }>(
        "/api/auth/login",
        jsonBody({ username, password }),
      );
      await login(data.accessToken);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function otpAction(send: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const data = await requestJson<{ accessToken?: string }>(
        `/api/auth/${send ? "send-otp" : "verify-otp"}`,
        jsonBody({ phone, code }),
      );
      if (send) setMessage("验证码已发送，请查看服务端日志");
      else {
        if (data.accessToken) await login(data.accessToken);
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel narrow login-card">
      <h1>欢迎回来</h1>
      <p className="muted login-intro">登录后查看你的记录与地图</p>
      {status === "loading" || signedIn ? (
        <p role="status">正在验证登录状态…</p>
      ) : status === "error" ? (
        <>
          <p role="alert" className="error">
            {error}
          </p>
          <button onClick={() => void retry()}>重试验证</button>
        </>
      ) : (
        <>
          <div className="tabs" aria-label="登录方式">
            <button
              type="button"
              className="tab"
              aria-pressed={mode === "password"}
              onClick={() => setMode("password")}
            >
              账号密码
            </button>
            <button
              type="button"
              className="tab"
              aria-pressed={mode === "otp"}
              onClick={() => setMode("otp")}
            >
              手机验证码
            </button>
          </div>
          {mode === "password" ? (
            <form onSubmit={loginPassword}>
              <label htmlFor="username">用户名</label>
              <input
                id="username"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <label htmlFor="password">密码</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p>
                <button disabled={busy}>登录</button>
              </p>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void otpAction(false);
              }}
            >
              <p className="muted">
                测试模式：验证码见服务端日志。验证码十分钟内有效。
              </p>
              <label htmlFor="phone">手机号</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || !phone}
                  onClick={() => void otpAction(true)}
                >
                  发送验证码
                </button>
              </p>
              <label htmlFor="code">验证码</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <p>
                <button disabled={busy}>登录</button>
              </p>
            </form>
          )}
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
