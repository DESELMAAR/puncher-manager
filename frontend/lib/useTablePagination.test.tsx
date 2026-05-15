import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTablePagination } from "@/lib/useTablePagination";

describe("useTablePagination", () => {
  const items = Array.from({ length: 32 }, (_, i) => `row-${i + 1}`);

  it("starts on page 1 with first page slice", () => {
    const { result } = renderHook(() => useTablePagination(items));
    expect(result.current.page).toBe(1);
    expect(result.current.paginatedItems).toHaveLength(15);
    expect(result.current.paginatedItems[0]).toBe("row-1");
    expect(result.current.totalPages).toBe(3);
    expect(result.current.totalItems).toBe(32);
  });

  it("navigates to next page", () => {
    const { result } = renderHook(() => useTablePagination(items));
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    expect(result.current.paginatedItems[0]).toBe("row-16");
  });

  it("resets to page 1 when reset deps change", () => {
    const { result, rerender } = renderHook(
      ({ filter }: { filter: string }) => useTablePagination(items, [filter]),
      { initialProps: { filter: "a" } },
    );
    act(() => result.current.setPage(2));
    rerender({ filter: "b" });
    expect(result.current.page).toBe(1);
  });
});
