import { expect, it } from "vitest";
import { formatPrice } from "@/lib/format-price";

it("formats yuan without trailing zeros and hides empty values", () => {
  expect(formatPrice(12.5)).toBe("12.5 元");
  expect(formatPrice(12)).toBe("12 元");
  expect(formatPrice(12.5)).toBe("12.5 元");
  expect(formatPrice(0)).toBe("0 元");
  expect(formatPrice(null)).toBeNull();
  expect(formatPrice(undefined)).toBeNull();
});
