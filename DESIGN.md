# Application design
Surface mode: Operate. Approved redesign uses map as focal content and exactly two count cards.
Palette: canvas #f6f7f9, surface #ffffff, ink #20242c, muted #626975, border #e3e6eb, food accent #a94f2d, item accent #456c65.
Typography: Microsoft YaHei first, followed by PingFang SC, Segoe UI and system sans-serif; no Google Fonts. Headings 24–30px, content 14–16px, tabular numeric counts.
Layout: max 1280px, left-aligned content, 16px mobile gutters, 24–32px desktop gutters. Cards 16px radius, subtle borders; floating navigation alone gets elevation.
Desktop: fixed bottom centered Dock. Below 768px: right-bottom expanding menu with icon and label, 44px minimum targets and safe-area offsets. All content clears navigation.
Map: neutral UI surrounds real OSM map; food and item markers differ by icon and color, nearby points cluster. No decorative illustration, textures or large promotional hero.
