import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBills } from "@/api/bills";
import { useBills, useBillTypes } from "./useBills";
import type { BillRecord, BillsApiResponse } from "@/types";

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

describe("useBills", () => {
  beforeEach(() => {
    mockedFetchBills.mockReset();
  });

  it("maps the API response into bills and total", async () => {
    const response: BillsApiResponse = {
      head: { counts: { billCount: 2 } },
      results: [buildRecord({ billNo: "1" }), buildRecord({ billNo: "2" })],
    };
    mockedFetchBills.mockResolvedValue(response);

    const { result } = renderHook(() => useBills({ page: 0, pageSize: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

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

    await waitFor(() => expect(mockedFetchBills).toHaveBeenCalled());

    expect(mockedFetchBills).toHaveBeenCalledWith({
      limit: 10,
      skip: 20,
      bill_type: undefined,
    });
  });

  it("passes typeFilter through as bill_type", async () => {
    mockedFetchBills.mockResolvedValue({
      head: { counts: { billCount: 0 } },
      results: [],
    });

    renderHook(() => useBills({ page: 0, pageSize: 20, typeFilter: "pub" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockedFetchBills).toHaveBeenCalled());

    expect(mockedFetchBills).toHaveBeenCalledWith({
      limit: 20,
      skip: 0,
      bill_type: "pub",
    });
  });

  it("sends bill_type as undefined when typeFilter is an empty string", async () => {
    mockedFetchBills.mockResolvedValue({
      head: { counts: { billCount: 0 } },
      results: [],
    });

    renderHook(() => useBills({ page: 0, pageSize: 20, typeFilter: "" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockedFetchBills).toHaveBeenCalled());

    expect(mockedFetchBills).toHaveBeenCalledWith(
      expect.objectContaining({ bill_type: undefined })
    );
  });

  it("exposes the error when the fetch rejects", async () => {
    mockedFetchBills.mockRejectedValue(new Error("API error: 500 Internal Server Error"));

    const { result } = renderHook(() => useBills({ page: 0, pageSize: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("API error: 500 Internal Server Error");
  });

  it("uses a distinct query key per page/pageSize/typeFilter combination", async () => {
    mockedFetchBills.mockResolvedValue({
      head: { counts: { billCount: 0 } },
      results: [],
    });

    const wrapper = createWrapper();
    const { rerender, result } = renderHook(
      ({ page, pageSize, typeFilter }: { page: number; pageSize: number; typeFilter?: string }) =>
        useBills({ page, pageSize, typeFilter }),
      { wrapper, initialProps: { page: 0, pageSize: 20, typeFilter: undefined } }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedFetchBills).toHaveBeenCalledTimes(1);

    rerender({ page: 1, pageSize: 20, typeFilter: undefined });

    await waitFor(() => expect(mockedFetchBills).toHaveBeenCalledTimes(2));
  });
});

describe("useBillTypes", () => {
  beforeEach(() => {
    mockedFetchBills.mockReset();
  });

  it("returns the distinct, non-empty bill types from the first page of results", async () => {
    mockedFetchBills.mockResolvedValue({
      head: { counts: { billCount: 3 } },
      results: [
        buildRecord({ billType: "Public" }),
        buildRecord({ billType: "Private" }),
        buildRecord({ billType: "Public" }),
      ],
    });

    const { result } = renderHook(() => useBillTypes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current).toEqual(["Public", "Private"]));
  });

  it("filters out empty bill types", async () => {
    mockedFetchBills.mockResolvedValue({
      head: { counts: { billCount: 2 } },
      results: [buildRecord({ billType: "" }), buildRecord({ billType: "Public" })],
    });

    const { result } = renderHook(() => useBillTypes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current).toEqual(["Public"]));
  });

  it("returns an empty array before the query resolves", () => {
    mockedFetchBills.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useBillTypes(), { wrapper: createWrapper() });

    expect(result.current).toEqual([]);
  });

  it("requests a large page size so it captures all known types", async () => {
    mockedFetchBills.mockResolvedValue({
      head: { counts: { billCount: 0 } },
      results: [],
    });

    renderHook(() => useBillTypes(), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedFetchBills).toHaveBeenCalledWith({ limit: 1000, skip: 0 }));
  });
});
