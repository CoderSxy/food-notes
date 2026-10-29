import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = { title: "美食地图", description: "记下好味道，发现身边的美食" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><header><Link href="/" className="brand">美食地图<span>记下每一口值得的味道</span></Link><nav><Link href="/entries/new">记一笔</Link><Link href="/recommend">AI 推荐</Link><Link href="/login">登录 / 账号</Link></nav></header><main>{children}</main><footer>美食地图 · 让好味道有迹可循</footer></body></html>;
}
