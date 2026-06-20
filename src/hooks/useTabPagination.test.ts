import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PAGE_SIZE_OPTIONS, useTabPagination } from "./useTabPagination";

type TestTab = "all" | "favourites";

describe("useTabPagination", () => {
  it("starts at the default page and pageSize for the initial tab", () => {
    const { result } = renderHook(() => useTabPagination<TestTab>("all"));

    expect(result.current.pagination).toEqual({ page: 0, pageSize: 20 });
  });

  it("updates the active tab's page via the functional setter form", () => {
    const { result } = renderHook(() => useTabPagination<TestTab>("all"));

    act(() => {
      result.current.setPagination((prev) => ({ ...prev, page: 3 }));
    });

    expect(result.current.pagination).toEqual({ page: 3, pageSize: 20 });
  });

  it("updates the active tab's pagination via the object setter form", () => {
    const { result } = renderHook(() => useTabPagination<TestTab>("all"));

    act(() => {
      result.current.setPagination({ page: 0, pageSize: 50 });
    });

    expect(result.current.pagination).toEqual({ page: 0, pageSize: 50 });
  });

  it("keeps a tab's pagination independent — changing one tab doesn't affect the other", () => {
    const { result, rerender } = renderHook(({ tab }) => useTabPagination<TestTab>(tab), {
      initialProps: { tab: "all" as TestTab },
    });

    act(() => {
      result.current.setPagination((prev) => ({ ...prev, page: 4 }));
    });
    expect(result.current.pagination).toEqual({ page: 4, pageSize: 20 });

    // switch tabs
    rerender({ tab: "favourites" });

    // favourites tab has never been touched — should be the default, not page 4
    expect(result.current.pagination).toEqual({ page: 0, pageSize: 20 });

    act(() => {
      result.current.setPagination((prev) => ({ ...prev, page: 1 }));
    });
    expect(result.current.pagination).toEqual({ page: 1, pageSize: 20 });

    // switch back to "all" — page 4 should still be there, untouched by favourites changes
    rerender({ tab: "all" });
    expect(result.current.pagination).toEqual({ page: 4, pageSize: 20 });
  });

  it("resetAllTabsToFirstPage zeroes the page on every tab that has been touched, preserving pageSize", () => {
    const { result, rerender } = renderHook(({ tab }) => useTabPagination<TestTab>(tab), {
      initialProps: { tab: "all" as TestTab },
    });

    act(() => {
      result.current.setPagination({ page: 5, pageSize: 50 });
    });

    rerender({ tab: "favourites" });
    act(() => {
      result.current.setPagination({ page: 2, pageSize: 10 });
    });

    act(() => {
      result.current.resetAllTabsToFirstPage();
    });

    // favourites (active tab) reset, pageSize untouched
    expect(result.current.pagination).toEqual({ page: 0, pageSize: 10 });

    // switch back and confirm "all" was reset too, not just the active tab
    rerender({ tab: "all" });
    expect(result.current.pagination).toEqual({ page: 0, pageSize: 50 });
  });

  it("resetAllTabsToFirstPage on a tab that was never explicitly set still resolves to the default", () => {
    const { result } = renderHook(() => useTabPagination<TestTab>("all"));

    act(() => {
      result.current.resetAllTabsToFirstPage();
    });

    expect(result.current.pagination).toEqual({ page: 0, pageSize: 20 });
  });

  it("falls back to DEFAULT_PAGINATION when switching to a tab not yet present in state", () => {
    const { result, rerender } = renderHook(({ tab }) => useTabPagination<TestTab>(tab), {
      initialProps: { tab: "all" as TestTab },
    });

    rerender({ tab: "favourites" });

    expect(result.current.pagination).toEqual({ page: 0, pageSize: 20 });
  });

  it("exports the expected page size options", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50]);
  });
});
