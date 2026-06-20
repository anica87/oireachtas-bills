import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBills, mapBillRecord } from "@/api/bills";
import type { Bill, BillRecord, BillsApiResponse } from "@/types";
import { useAllBills } from "./useAllBills";

vi.mock("@/api/bills");

const mockFetchBills = vi.mocked(fetchBills);
const mockMapBillRecord = vi.mocked(mapBillRecord);

function makeBillRecord(id: string): BillRecord {
  return {
    bill: {
      uri: id,
      billNo: id,
      billYear: "2026",
      billType: "Public",
      status: "First Stage",
      sponsors: [],
    },
  } as unknown as BillRecord;
}

function makeApiResponse(records: BillRecord[], totalCount: number): BillsApiResponse {
  return {
    head: { counts: { billCount: totalCount } },
    results: records,
  } as unknown as BillsApiResponse;
}

function makeBill(id: string): Bill {
  return {
    id,
    billNo: id,
    billYear: "2026",
    billNoDisplay: `${id}/2026`,
    billType: "Public",
    status: "First Stage",
    shortTitleEn: "",
    shortTitleGa: "",
    longTitleEn: "",
    longTitleGa: "",
    sponsor: "Unknown",
    originHouse: "",
    uri: id,
  };
}

function batchOf(count: number, prefix: string): BillRecord[] {
  return Array.from({ length: count }, (_, i) => makeBillRecord(`${prefix}${i}`));
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useAllBills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMapBillRecord.mockImplementation((record: BillRecord) => makeBill(record.bill.uri));
  });

  describe("enabled flag (lazy loading)", () => {
    it("does not call fetchBills when enabled is false", () => {
      renderHook(() => useAllBills(false), { wrapper: createWrapper() });

      expect(mockFetchBills).not.toHaveBeenCalled();
    });

    it("calls fetchBills once enabled becomes true", async () => {
      mockFetchBills.mockResolvedValue(makeApiResponse(batchOf(2, "a"), 2));

      const wrapper = createWrapper();
      const { rerender } = renderHook(({ enabled }) => useAllBills(enabled), {
        wrapper,
        initialProps: { enabled: false },
      });

      expect(mockFetchBills).not.toHaveBeenCalled();

      rerender({ enabled: true });

      await waitFor(() => expect(mockFetchBills).toHaveBeenCalled());
    });

    it("defaults to enabled when no argument is passed", async () => {
      mockFetchBills.mockResolvedValue(makeApiResponse(batchOf(1, "a"), 1));

      renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(mockFetchBills).toHaveBeenCalled());
    });
  });

  describe("single-batch results (total <= BATCH_SIZE)", () => {
    it("returns all results from a single request when total fits in one batch", async () => {
      mockFetchBills.mockResolvedValueOnce(makeApiResponse(batchOf(2, "a"), 2));

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetchBills).toHaveBeenCalledTimes(1);
      expect(mockFetchBills).toHaveBeenCalledWith({ limit: 1000, skip: 0 });
      expect(result.current.data).toHaveLength(2);
    });

    it("makes no second request when total is exactly BATCH_SIZE (boundary)", async () => {
      mockFetchBills.mockResolvedValueOnce(makeApiResponse(batchOf(1000, "a"), 1000));

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // total === BATCH_SIZE -> remainingBatchCount must be exactly 0, not 1
      expect(mockFetchBills).toHaveBeenCalledTimes(1);
      expect(result.current.data).toHaveLength(1000);
    });

    it("returns an empty array without a second request when total is 0", async () => {
      mockFetchBills.mockResolvedValueOnce(makeApiResponse([], 0));

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetchBills).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual([]);
    });
  });

  describe("multi-batch results (total > BATCH_SIZE)", () => {
    it("fetches the first batch, then fires all remaining batches as a single wave (not sequentially)", async () => {
      // 2500 total -> 1 first request + 2 remaining (skip=1000, skip=2000)
      const callOrder: number[] = [];
      let resolveFirst: (() => void) | undefined;
      const firstGate = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      mockFetchBills.mockImplementation(async ({ skip }) => {
        callOrder.push(skip);
        if (skip === 0) {
          // first call resolves immediately and "unlocks" the others
          const response = makeApiResponse(batchOf(1000, "a"), 2500);
          resolveFirst?.();
          return response;
        }
        // remaining batches: wait until after the first has resolved,
        // confirming they were dispatched (not just resolved) concurrently
        await firstGate;
        const count = skip === 2000 ? 500 : 1000;
        return makeApiResponse(batchOf(count, `b${skip}`), 2500);
      });

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetchBills).toHaveBeenCalledTimes(3);
      expect(mockFetchBills).toHaveBeenCalledWith({ limit: 1000, skip: 0 });
      expect(mockFetchBills).toHaveBeenCalledWith({ limit: 1000, skip: 1000 });
      expect(mockFetchBills).toHaveBeenCalledWith({ limit: 1000, skip: 2000 });
      expect(result.current.data).toHaveLength(2500);
    });

    it("computes the correct number of batches for a non-exact-multiple total (2500 -> 3 batches)", async () => {
      mockFetchBills.mockImplementation(async ({ skip }) => {
        if (skip === 0) return makeApiResponse(batchOf(1000, "a"), 2500);
        if (skip === 1000) return makeApiResponse(batchOf(1000, "b"), 2500);
        if (skip === 2000) return makeApiResponse(batchOf(500, "c"), 2500);
        throw new Error(`unexpected skip ${skip}`);
      });

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetchBills).toHaveBeenCalledTimes(3);
      expect(result.current.data).toHaveLength(2500);
    });

    it("requests exactly the right number of batches when total is one more than an exact multiple (2001 -> 3 batches)", async () => {
      mockFetchBills.mockImplementation(async ({ skip }) => {
        if (skip === 0) return makeApiResponse(batchOf(1000, "a"), 2001);
        if (skip === 1000) return makeApiResponse(batchOf(1000, "b"), 2001);
        if (skip === 2000) return makeApiResponse(batchOf(1, "c"), 2001);
        throw new Error(`unexpected skip ${skip}`);
      });

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetchBills).toHaveBeenCalledTimes(3);
      expect(result.current.data).toHaveLength(2001);
    });

    it("preserves first-batch results first, with remaining batches appended in skip order", async () => {
      // total=1001 requires exactly 2 batches: skip=0 (1000 records) and
      // skip=1000 (1 record) -- the boundary case from the off-by-one check
      mockFetchBills.mockImplementation(async ({ skip }) => {
        if (skip === 0) return makeApiResponse([makeBillRecord("first")], 1001);
        if (skip === 1000) return makeApiResponse([makeBillRecord("second")], 1001);
        throw new Error(`unexpected skip ${skip}`);
      });

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.map((b) => b.id)).toEqual(["first", "second"]);
    });
  });

  describe("error handling", () => {
    it("surfaces an error if the first request fails", async () => {
      mockFetchBills.mockRejectedValueOnce(new Error("API error: 500"));

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(mockFetchBills).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeInstanceOf(Error);
    });

    it("surfaces an error (all-or-nothing) if any parallel remaining batch fails, even if others succeed", async () => {
      mockFetchBills.mockImplementation(async ({ skip }) => {
        if (skip === 0) return makeApiResponse(batchOf(1000, "a"), 3000);
        if (skip === 1000) return makeApiResponse(batchOf(1000, "b"), 3000);
        if (skip === 2000) throw new Error("API error: 503");
        throw new Error(`unexpected skip ${skip}`);
      });

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Promise.all rejects as a whole; no partial data should be exposed
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("mapping", () => {
    it("applies mapBillRecord to every record across the first batch and all parallel batches", async () => {
      mockFetchBills.mockImplementation(async ({ skip }) => {
        if (skip === 0) return makeApiResponse(batchOf(1000, "a"), 1500);
        if (skip === 1000) return makeApiResponse(batchOf(500, "b"), 1500);
        throw new Error(`unexpected skip ${skip}`);
      });

      const { result } = renderHook(() => useAllBills(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockMapBillRecord).toHaveBeenCalledTimes(1500);
      expect(result.current.data).toHaveLength(1500);
    });
  });
});
