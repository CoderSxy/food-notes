import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("adds a nullable item-only price column", () => {
  const sql = readFileSync("supabase/migrations/007_entry_item_price.sql", "utf8");
  expect(sql).toContain("add column price numeric(10,2)");
  expect(sql).toContain("entries_price_nonnegative");
  expect(sql).toContain("entries_price_item_only");
  expect(sql).toContain("kind = 'item'");
});
