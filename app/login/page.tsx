'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestJson, jsonBody } from '@/lib/browser';

type Mode = 'password' | 'otp';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.ok) setSignedIn(true);
      })
      .catch(() => {});
  }, []);

  async function loginPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await requestJson('/api/auth/login', jsonBody({ username, password }));
      router.push('/');
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function otpAction(send: boolean) {
    setBusy(true);
    setMessage('');
    try {
      await requestJson(`/api/auth/${send ? 'send-otp' : 'verify-otp'}`, jsonBody({ phone, code }));
      if (send) setMessage('验证码已发送，请查看服务端日志');
      else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel narrow">
      <h1>登录美食地图</h1>
      {signedIn ? (
        <>
          <p>你已登录，可以继续记录美食。</p>
          <button
            onClick={async () => {
              await requestJson('/api/auth/logout', jsonBody({}));
              setSignedIn(false);
              setMessage('已退出登录');
            }}
          >
            退出登录
          </button>
        </>
      ) : (
        <>
          <p className="muted">
            <button type="button" onClick={() => setMode('password')} disabled={mode === 'password'}>
              账号密码
            </button>
            {' · '}
            <button type="button" onClick={() => setMode('otp')} disabled={mode === 'otp'}>
              手机验证码
            </button>
          </p>
          {mode === 'password' ? (
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
              <p className="muted">测试模式：验证码见服务端日志。验证码十分钟内有效。</p>
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
                <button type="button" disabled={busy || !phone} onClick={() => void otpAction(true)}>
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
