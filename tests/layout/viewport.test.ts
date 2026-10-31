import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("exports a Next.js viewport that disables mobile pinch-zoom", () => {
  const source = readFileSync("app/layout.tsx", "utf8");
  expect(source).toContain('import type { Metadata, Viewport } from "next"');
  expect(source).toContain("export const viewport");
  expect(source).toContain('width: "device-width"');
  expect(source).toMatch(/initialScale:\s*1/);
  expect(source).toMatch(/maximumScale:\s*1/);
  expect(source).toMatch(/userScalable:\s*false/);
  expect(source).not.toContain('<meta name="viewport"');
});
