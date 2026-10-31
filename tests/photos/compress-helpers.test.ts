import { describe, expect, it } from "vitest";
import { scaleToMaxEdge } from "@/lib/browser-photos";

describe("scaleToMaxEdge", () => {
  it("leaves smaller images unchanged", () => {
    expect(scaleToMaxEdge(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
  it("scales landscape images by the long edge", () => {
    expect(scaleToMaxEdge(4096, 2048)).toEqual({ width: 2048, height: 1024 });
  });
  it("scales portrait images by the long edge", () => {
    expect(scaleToMaxEdge(1080, 3240, 2048)).toEqual({
      width: 683,
      height: 2048,
    });
  });
});
