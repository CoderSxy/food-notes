import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("starts the new-entry page on the form with no intro heading", () => {
  const source = readFileSync("app/entries/new/page.tsx", "utf8");
  expect(source).toContain("EntryForm");
  expect(source).not.toContain("增加记录");
  expect(source).not.toContain("收藏餐饮");
  expect(source).not.toContain("page-intro");
});
