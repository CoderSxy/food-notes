"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "./Icon";
const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/entries", label: "记录", icon: "records" },
  { href: "/entries/new", label: "增加", icon: "plus" },
  { href: "/recommend", label: "AI 推荐", icon: "spark" },
  { href: "/account", label: "账号", icon: "user" },
];
export default function AppDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [open]);
  const active = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/entries"
        ? pathname.startsWith("/entries") && pathname !== "/entries/new"
        : pathname === href;
  return (
    <nav
      ref={root}
      className={`app-dock${open ? " is-open" : ""}`}
      aria-label="主导航"
    >
      <div className="dock-items" id="app-menu">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`dock-link${active(item.href) ? " is-active" : ""}${item.icon === "plus" ? " dock-add" : ""}`}
            aria-current={active(item.href) ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
      <button
        ref={toggle}
        className="dock-toggle"
        aria-label={open ? "收起菜单" : "展开菜单"}
        aria-expanded={open}
        aria-controls="app-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "close" : "menu"} />
      </button>
    </nav>
  );
}
