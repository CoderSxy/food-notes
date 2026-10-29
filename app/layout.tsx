import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "美食地图", description: "记下好味道，发现身边的美食" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- next/font lacks CJK unicode-range for these families */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=ZCOOL+XiaoWei&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            <svg className="brand-mark" viewBox="0 0 36 36" aria-hidden="true">
              <path d="M10 9.5c1.2 2.4 2.6 3.7 8 3.7s6.8-1.3 8-3.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M8 16.5h20c-.4 8.2-4.6 13-10 13s-9.6-4.8-10-13z" fill="currentColor" />
              <path d="M7 16.5h22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="brand-copy">美食地图<span>记下每一口值得的味道</span></span>
          </Link>
          <nav className="site-nav">
            <Link href="/entries/new">记一笔</Link>
            <Link href="/recommend">AI 推荐</Link>
            <Link href="/login">登录 / 账号</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">美食地图 · 让好味道有迹可循</footer>
      </body>
    </html>
  );
}
