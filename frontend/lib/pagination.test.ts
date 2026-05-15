import { describe, expect, it } from "vitest";
import {
  getPageRange,
  getTotalPages,
  slicePage,
  TABLE_PAGE_SIZE,
} from "@/lib/pagination";

describe("pagination", () => {
  const items = Array.from({ length: 40 }, (_, i) => i + 1);

  it("uses 15 rows per page by default", () => {
    expect(TABLE_PAGE_SIZE).toBe(15);
    expect(slicePage(items, 1)).toHaveLength(15);
    expect(slicePage(items, 1)[0]).toBe(1);
    expect(slicePage(items, 1)[14]).toBe(15);
  });

  it("slices second page correctly", () => {
    expect(slicePage(items, 2)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 16),
    );
  });

  it("slices last partial page", () => {
    expect(slicePage(items, 3)).toEqual([31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
  });

  it("computes total pages", () => {
    expect(getTotalPages(0)).toBe(1);
    expect(getTotalPages(15)).toBe(1);
    expect(getTotalPages(16)).toBe(2);
    expect(getTotalPages(40)).toBe(3);
  });

  it("computes display range", () => {
    expect(getPageRange(1, 15, 40)).toEqual({ from: 1, to: 15 });
    expect(getPageRange(3, 15, 40)).toEqual({ from: 31, to: 40 });
    expect(getPageRange(1, 15, 0)).toEqual({ from: 0, to: 0 });
  });
});
