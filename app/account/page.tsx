"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import PageHeader from "@/components/layout/PageHeader";
import Icon from "@/components/layout/Icon";
export default function Account() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="narrow">
      <PageHeader title="账号" description="管理当前登录状态" />
      <section className="panel">
        <div className="row">
          <span className="avatar account-avatar">
            {(user?.nickname || user?.username || "我").slice(0, 1)}
          </span>
          <div>
            <h2>{user?.nickname || user?.username || "我的账号"}</h2>
            <p className="muted">已登录</p>
          </div>
        </div>
        <dl className="account-details">
          {user?.username && (
            <div>
              <dt>用户名</dt>
              <dd>{user.username}</dd>
            </div>
          )}
          {user?.nickname && (
            <div>
              <dt>昵称</dt>
              <dd>{user.nickname}</dd>
            </div>
          )}
          {user?.phone && (
            <div>
              <dt>手机号</dt>
              <dd>{user.phone}</dd>
            </div>
          )}
        </dl>
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await logout();
            } catch {
              /* Local credentials are cleared even offline. */
            } finally {
              router.replace("/login");
            }
          }}
        >
          <Icon name="logout" size={18} />
          {busy ? "正在退出…" : "退出登录"}
        </button>
      </section>
    </div>
  );
}
