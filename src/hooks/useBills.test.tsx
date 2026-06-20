import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchBillsParams } from "@/api/bills";
import { fetchBills } from "@/api/bills";
import type { BillRecord } from "@/types";
import { useBills } from "./useBills";

vi.mock("@/api/bills", async () => {
  const actual = await vi.importActual<typeof import("@/api/bills")>("@/api/bills");
  return {
    ...actual,
    fetchBills: vi.fn(),
  };
});

const mockedFetchBills = vi.mocked(fetchBills);

function buildRecord(overrides: Partial<BillRecord["bill"]> = {}): BillRecord {
  return {
    bill: {
      billNo: "42",
      billYear: "2024",
      billType: "Public",
      status: "First Stage",
      shortTitleEn: "Short Title EN",
      shortTitleGa: "Short Title GA",
      sponsors: [],
      uri: "http://data.oireachtas.ie/ie/oireachtas/bill/2024/42",
      ...overrides,
    },
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function findCall(limit: number, skip: number) {
  return mockedFetchBills.mock.calls.find(
    ([args]: [FetchBillsParams?]) => args?.limit === limit && args?.skip === skip,
  );
}

describe("useBills", () => {
  beforeEach(() => {
    mockedFetchBills.mockReset();
  });

  describe("default state: no typeFilter, filterTouched not set", () => {
    it("calls fetchBills exactly once — the all-bills batch fetch stays disabled", async () => {
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 2 } },
        results: [buildRecord({ billNo: "1" }), buildRecord({ billNo: "2" })],
      });

      const { result } = renderHook(() => useBills({ page: 0, pageSize: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).toBeDefined());

      // with filterTouched omitted (falsy) and no typeFilter, useAllBills
      // must stay disabled — only the paginated query should ever fire
      expect(mockedFetchBills).toHaveBeenCalledTimes(1);
      expect(mockedFetchBills).toHaveBeenCalledWith({ limit: 20, skip: 0 });
    });

    it("maps the API response into bills and total", async () => {
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 2 } },
        results: [buildRecord({ billNo: "1" }), buildRecord({ billNo: "2" })],
      });

      const { result } = renderHook(() => useBills({ page: 0, pageSize: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.data?.bills).toHaveLength(2);
      expect(result.current.data?.bills[0].billNo).toBe("1");
      expect(result.current.data?.total).toBe(2);
    });

    it("converts page and pageSize into limit and skip", async () => {
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 0 } },
        results: [],
      });

      renderHook(() => useBills({ page: 2, pageSize: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(mockedFetchBills).toHaveBeenCalledWith({ limit: 10, skip: 20 }));
    });

    it("re-fetches when page or pageSize changes", async () => {
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 0 } },
        results: [],
      });

      const wrapper = createWrapper();
      const { rerender } = renderHook(
        ({ page, pageSize }: { page: number; pageSize: number }) => useBills({ page, pageSize }),
        { wrapper, initialProps: { page: 0, pageSize: 20 } },
      );

      await waitFor(() => expect(findCall(20, 0)).toBeDefined());

      rerender({ page: 1, pageSize: 20 });

      await waitFor(() => expect(findCall(20, 20)).toBeDefined());
    });

    it("exposes the error when the paginated fetch rejects", async () => {
      mockedFetchBills.mockRejectedValue(new Error("API error: 500"));

      const { result } = renderHook(() => useBills({ page: 0, pageSize: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toMatch(/500/);
    });
  });

  describe("filterTouched=true, no typeFilter yet", () => {
    it("enables the all-bills batch fetch (useAllBills(!!filterTouched)) even without typeFilter", async () => {
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 0 } },
        results: [],
      });

      renderHook(() => useBills({ page: 0, pageSize: 20, filterTouched: true }), {
        wrapper: createWrapper(),
      });

      // both the paginated query (limit 20) and the batch fetch (limit 1000)
      // should fire, since useAllBills now only checks !!filterTouched
      await waitFor(() => expect(findCall(1000, 0)).toBeDefined());
      expect(findCall(20, 0)).toBeDefined();
    });

    it("still returns the unfiltered/paginated data as `data` since typeFilter is not set", async () => {
      mockedFetchBills.mockImplementation(async ({ limit, skip } = {}) => {
        if (limit === 20 && skip === 0) {
          return {
            head: { counts: { billCount: 1 } },
            results: [buildRecord({ billNo: "1" })],
          };
        }
        return { head: { counts: { billCount: 0 } }, results: [] };
      });

      const { result } = renderHook(
        () => useBills({ page: 0, pageSize: 20, filterTouched: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.data?.total).toBe(1));

      expect(result.current.data?.bills[0].billNo).toBe("1");
    });
  });

  describe("typeFilter set (client-side filtering active)", () => {
    it("does not send bill_type to fetchBills — filtering happens client-side via useAllBills", async () => {
      mockedFetchBills.mockImplementation(async ({ limit, skip } = {}) => {
        if (limit === 1000 && skip === 0) {
          return {
            head: { counts: { billCount: 2 } },
            results: [
              buildRecord({ billNo: "1", billType: "Public" }),
              buildRecord({ billNo: "2", billType: "Private" }),
            ],
          };
        }
        return { head: { counts: { billCount: 0 } }, results: [] };
      });

      const { result } = renderHook(
        () => useBills({ page: 0, pageSize: 20, typeFilter: "Public", filterTouched: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.data?.bills.length).toBeGreaterThan(0));

      for (const [args] of mockedFetchBills.mock.calls) {
        expect(args).not.toHaveProperty("bill_type");
      }

      expect(result.current.data?.bills).toHaveLength(1);
      expect(result.current.data?.bills[0].billType).toBe("Public");
      expect(result.current.data?.total).toBe(1);
    });

    it("disables the paginated query once typeFilter is set", async () => {
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 0 } },
        results: [],
      });

      renderHook(
        () => useBills({ page: 0, pageSize: 20, typeFilter: "Public", filterTouched: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(findCall(1000, 0)).toBeDefined());

      // the paginated (limit: 20) query should never fire while typeFilter is set
      expect(findCall(20, 0)).toBeUndefined();
    });

    it("paginates the filtered results client-side using page and pageSize", async () => {
      const allRecords = Array.from({ length: 5 }, (_, i) =>
        buildRecord({ billNo: `${i}`, billType: i % 2 === 0 ? "Public" : "Private" }),
      );
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 5 } },
        results: allRecords,
      });

      const { result } = renderHook(
        () => useBills({ page: 0, pageSize: 2, typeFilter: "Public", filterTouched: true }),
        { wrapper: createWrapper() },
      );

      // 3 "Public" bills total (indices 0, 2, 4), pageSize 2 -> first page has 2
      await waitFor(() => expect(result.current.data?.total).toBe(3));

      expect(result.current.data?.bills).toHaveLength(2);
      expect(result.current.data?.bills.every((b) => b.billType === "Public")).toBe(true);
    });

    it("returns the second page of filtered results when page is incremented", async () => {
      const allRecords = Array.from({ length: 5 }, (_, i) =>
        buildRecord({ billNo: `${i}`, billType: i % 2 === 0 ? "Public" : "Private" }),
      );
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 5 } },
        results: allRecords,
      });

      const { result } = renderHook(
        () => useBills({ page: 1, pageSize: 2, typeFilter: "Public", filterTouched: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.data?.total).toBe(3));

      // 3 Public bills total, pageSize 2 -> page 1 (second page) has the remaining 1
      expect(result.current.data?.bills).toHaveLength(1);
    });

    it("returns an empty result, not an error, when no bills match the filter", async () => {
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 1 } },
        results: [buildRecord({ billNo: "1", billType: "Private" })],
      });

      const { result } = renderHook(
        () =>
          useBills({
            page: 0,
            pageSize: 20,
            typeFilter: "Nonexistent Type",
            filterTouched: true,
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.bills).toEqual([]);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("exposes the error from the batch fetch when it rejects while typeFilter is set", async () => {
      mockedFetchBills.mockRejectedValue(new Error("API error: 500"));

      const { result } = renderHook(
        () => useBills({ page: 0, pageSize: 20, typeFilter: "Public", filterTouched: true }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe("falsy typeFilter (empty string)", () => {
    it("treats an empty-string typeFilter as unfiltered (falls back to the paginated path)", async () => {
      mockedFetchBills.mockImplementation(async ({ limit, skip } = {}) => {
        if (limit === 20 && skip === 0) {
          return {
            head: { counts: { billCount: 1 } },
            results: [buildRecord({ billNo: "1" })],
          };
        }
        return { head: { counts: { billCount: 0 } }, results: [] };
      });

      const { result } = renderHook(() => useBills({ page: 0, pageSize: 20, typeFilter: "" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.data?.bills).toHaveLength(1);
      expect(result.current.data?.total).toBe(1);
    });
  });

  describe("filterTouched omitted entirely vs explicitly false", () => {
    it("behaves identically whether filterTouched is omitted or passed as false", async () => {
      mockedFetchBills.mockResolvedValue({
        head: { counts: { billCount: 0 } },
        results: [],
      });

      renderHook(() => useBills({ page: 0, pageSize: 20, filterTouched: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(findCall(20, 0)).toBeDefined());

      // the batch fetch (limit 1000) must not fire when filterTouched is
      // explicitly false, same as when it's omitted
      expect(findCall(1000, 0)).toBeUndefined();
    });
  });
});
