import type { Metadata, Viewport } from "next";
import AppShell from "@/components/layout/AppShell";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "美食地图",
  description: "记下好味道，发现身边的美食",
};

// iOS Safari: userScalable/maximumScale block pinch-zoom for low-vision users.
// Product still wants no mobile web zoom; desktop Ctrl+wheel is unchanged.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
