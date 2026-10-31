import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("uses the requested system typography without downloading Google fonts", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  expect(layout).not.toContain("next/font/google");
  expect(layout).not.toContain("fonts.googleapis");
  expect(css).toContain("Microsoft YaHei");
  expect(css).not.toContain("@font-face");
});
