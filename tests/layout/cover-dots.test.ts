import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("overrides global button sizing so cover dots stay round", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const start = css.indexOf(".entry-cover-dot {");
  expect(start).toBeGreaterThan(-1);
  const current = css.indexOf('.entry-cover-dot[aria-current="true"]');
  expect(current).toBeGreaterThan(start);
  const block = css.slice(start, current);
  expect(block).toMatch(/min-height:\s*0/);
  expect(block).toMatch(/min-width:\s*0/);
  expect(block).toContain("::after");
  expect(block).toMatch(/padding:\s*9px/);
  expect(css).toMatch(/\.entry-cover-dot::after[\s\S]*width:\s*6px/);
  expect(css).toMatch(/\.entry-cover-dot::after[\s\S]*height:\s*6px/);
  expect(css).toMatch(/\.entry-cover-dot::after[\s\S]*border-radius:\s*50%/);
  expect(css).toMatch(
    /\.entry-cover-dot\[aria-current="true"\]::after[\s\S]*width:\s*8px/,
  );
  expect(css).toMatch(
    /\.entry-cover-dot\[aria-current="true"\]::after[\s\S]*background:\s*var\(--terracotta\)/,
  );
});
