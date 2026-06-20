import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bill } from "@/types";
import { useAllBills } from "./useAllBills";
import { useBillTypes } from "./useBillTypes";

vi.mock("./useAllBills");

const mockUseAllBills = vi.mocked(useAllBills);

// useBillTypes only reads `.data` and `.isLoading` off the useAllBills result,
// so tests only need to mock those two fields rather than every property of
// the real (much larger) UseQueryResult type. Casting through `unknown` here
// — once, in a single helper — documents that this is an intentional partial
// mock, instead of an `as ReturnType<typeof useAllBills>` at every call site,
// which TypeScript can't reliably verify has "sufficient overlap" for an
// arbitrary partial shape (e.g. it rejects `data: []` but not other shapes).
function mockAllBillsResult(partial: { data: Bill[] | undefined; isLoading: boolean }) {
  return partial as unknown as ReturnType<typeof useAllBills>;
}

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    billNo: "1",
    billYear: "2026",
    billNoDisplay: "1/2026",
    billType: "Public",
    status: "First Stage",
    shortTitleEn: "",
    shortTitleGa: "",
    longTitleEn: "",
    longTitleGa: "",
    sponsor: "Unknown",
    originHouse: "",
    uri: "bill-1",
    ...overrides,
  };
}

describe("useBillTypes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enabled forwarding", () => {
    it("forwards enabled=true to useAllBills when called with no argument (default)", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: undefined,
          isLoading: false,
        }),
      );

      renderHook(() => useBillTypes());

      expect(mockUseAllBills).toHaveBeenCalledWith(true);
    });

    it("forwards enabled=false through to useAllBills when explicitly passed", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: undefined,
          isLoading: false,
        }),
      );

      renderHook(() => useBillTypes(false));

      expect(mockUseAllBills).toHaveBeenCalledWith(false);
    });

    it("forwards enabled=true through to useAllBills when explicitly passed", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: undefined,
          isLoading: false,
        }),
      );

      renderHook(() => useBillTypes(true));

      expect(mockUseAllBills).toHaveBeenCalledWith(true);
    });
  });

  describe("isLoading", () => {
    it("passes through isLoading: true from useAllBills while disabled-but-not-yet-fetched or fetching", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: undefined,
          isLoading: true,
        }),
      );

      const { result } = renderHook(() => useBillTypes(true));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.types).toEqual([]);
    });

    it("passes through isLoading: false once useAllBills has resolved", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: [makeBill()],
          isLoading: false,
        }),
      );

      const { result } = renderHook(() => useBillTypes(true));

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("types derivation", () => {
    it("returns an empty types array while data is undefined", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: undefined,
          isLoading: true,
        }),
      );

      const { result } = renderHook(() => useBillTypes());

      expect(result.current.types).toEqual([]);
    });

    it("returns an empty types array when bills is an empty list", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: [],
          isLoading: false,
        }),
      );

      const { result } = renderHook(() => useBillTypes());

      expect(result.current.types).toEqual([]);
    });

    it("deduplicates repeated bill types", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: [
            makeBill({ id: "1", billType: "Public" }),
            makeBill({ id: "2", billType: "Private" }),
            makeBill({ id: "3", billType: "Public" }),
            makeBill({ id: "4", billType: "Private" }),
          ],
          isLoading: false,
        }),
      );

      const { result } = renderHook(() => useBillTypes());

      expect(result.current.types).toEqual(["Public", "Private"]);
    });

    it("filters out falsy (empty-string) bill types", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: [
            makeBill({ id: "1", billType: "Public" }),
            makeBill({ id: "2", billType: "" }),
            makeBill({ id: "3", billType: "Private" }),
          ],
          isLoading: false,
        }),
      );

      const { result } = renderHook(() => useBillTypes());

      expect(result.current.types).toEqual(["Public", "Private"]);
      expect(result.current.types).not.toContain("");
    });

    it("preserves first-seen order rather than sorting", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: [
            makeBill({ id: "1", billType: "Withdrawn" }),
            makeBill({ id: "2", billType: "Amendment" }),
            makeBill({ id: "3", billType: "Government" }),
          ],
          isLoading: false,
        }),
      );

      const { result } = renderHook(() => useBillTypes());

      // no .sort() in the source — order should match first appearance,
      // NOT alphabetical (Amendment, Government, Withdrawn)
      expect(result.current.types).toEqual(["Withdrawn", "Amendment", "Government"]);
    });
  });

  describe("memoization", () => {
    it("returns the same types array reference across re-renders when bills data is unchanged", () => {
      const sharedBillsArray = [makeBill({ id: "1", billType: "Public" })];
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: sharedBillsArray,
          isLoading: false,
        }),
      );

      const { result, rerender } = renderHook(() => useBillTypes());

      const firstTypes = result.current.types;
      rerender();
      const secondTypes = result.current.types;

      // useMemo keyed on [bills] should skip recomputation when the
      // underlying data reference hasn't changed between renders
      expect(firstTypes).toBe(secondTypes);
    });

    it("recomputes types when the bills data reference changes", () => {
      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: [makeBill({ id: "1", billType: "Public" })],
          isLoading: false,
        }),
      );

      const { result, rerender } = renderHook(() => useBillTypes());
      const firstTypes = result.current.types;
      expect(firstTypes).toEqual(["Public"]);

      mockUseAllBills.mockReturnValue(
        mockAllBillsResult({
          data: [
            makeBill({ id: "1", billType: "Public" }),
            makeBill({ id: "2", billType: "Private" }),
          ],
          isLoading: false,
        }),
      );

      rerender();

      expect(result.current.types).toEqual(["Public", "Private"]);
    });
  });
});
