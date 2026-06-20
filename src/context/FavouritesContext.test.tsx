import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { favouriteBillRequest, unfavouriteBillRequest } from "@/api/favourites";
import type { Bill } from "@/types";
import { FavouritesProvider, useFavourites } from "./FavouritesContext";

vi.mock("@/api/favourites", async () => {
  const actual = await vi.importActual<typeof import("@/api/favourites")>("@/api/favourites");
  return {
    ...actual,
    favouriteBillRequest: vi.fn(),
    unfavouriteBillRequest: vi.fn(),
  };
});

const mockFavouriteBillRequest = vi.mocked(favouriteBillRequest);
const mockUnfavouriteBillRequest = vi.mocked(unfavouriteBillRequest);

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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <FavouritesProvider>{children}</FavouritesProvider>
      </QueryClientProvider>
    );
  };
}

describe("FavouritesContext", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFavouriteBillRequest.mockResolvedValue(undefined);
    mockUnfavouriteBillRequest.mockResolvedValue(undefined);
  });

  it("throws when useFavourites is called outside a FavouritesProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useFavourites())).toThrow(
      "useFavourites must be used within FavouritesProvider",
    );

    consoleError.mockRestore();
  });

  it("starts with no favourites", () => {
    const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

    expect(result.current.favourites).toEqual([]);
    expect(result.current.favouriteIds).toEqual([]);
    expect(result.current.isFavourite("bill-1")).toBe(false);
  });

  describe("the wasFavourite race condition fix", () => {
    // This is the specific bug that was found: mutationFn used to
    // re-derive "is this currently favourited" by reading the cache
    // AFTER onMutate had already optimistically flipped it — so on the
    // very first click of a never-before-toggled bill, mutationFn would
    // see the POST-update cache (bill now present) and incorrectly
    // conclude it was ALREADY favourited, dispatching unfavouriteBillRequest
    // instead of favouriteBillRequest. These tests assert the correct
    // request fires on a clean, first-ever toggle for several different
    // bills, which is exactly the scenario the bug occurred in.

    it("dispatches favouriteBillRequest (not unfavourite) on the very first toggle of a never-before-seen bill", async () => {
      const bill = makeBill({ id: "first-click-bill" });
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      act(() => {
        result.current.toggle(bill);
      });

      await waitFor(() =>
        expect(mockFavouriteBillRequest).toHaveBeenCalledWith("first-click-bill"),
      );

      // the buggy version would have called this instead — assert it
      // never does, not just that the correct one was called
      expect(mockUnfavouriteBillRequest).not.toHaveBeenCalled();
    });

    it("dispatches unfavouriteBillRequest (not favourite) on a second toggle of an already-favourited bill", async () => {
      const bill = makeBill({ id: "toggle-twice-bill" });
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      act(() => {
        result.current.toggle(bill);
      });
      await waitFor(() => expect(mockFavouriteBillRequest).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.toggle(bill);
      });
      await waitFor(() =>
        expect(mockUnfavouriteBillRequest).toHaveBeenCalledWith("toggle-twice-bill"),
      );

      expect(mockFavouriteBillRequest).toHaveBeenCalledTimes(1);
      expect(mockUnfavouriteBillRequest).toHaveBeenCalledTimes(1);
    });

    it("correctly dispatches favourite-then-unfavourite-then-favourite across three toggles in sequence", async () => {
      const bill = makeBill({ id: "abab-bill" });
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      act(() => {
        result.current.toggle(bill);
      });
      await waitFor(() => expect(mockFavouriteBillRequest).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.toggle(bill);
      });
      await waitFor(() => expect(mockUnfavouriteBillRequest).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.toggle(bill);
      });
      await waitFor(() => expect(mockFavouriteBillRequest).toHaveBeenCalledTimes(2));

      // confirm the count never drifts — exactly 2 favourite calls, 1 unfavourite
      expect(mockFavouriteBillRequest).toHaveBeenCalledTimes(2);
      expect(mockUnfavouriteBillRequest).toHaveBeenCalledTimes(1);
    });

    it("does not mix up requests when toggling two different never-before-seen bills back to back", async () => {
      const billA = makeBill({ id: "bill-a" });
      const billB = makeBill({ id: "bill-b" });
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      act(() => {
        result.current.toggle(billA);
      });
      act(() => {
        result.current.toggle(billB);
      });

      await waitFor(() => expect(mockFavouriteBillRequest).toHaveBeenCalledTimes(2));

      expect(mockFavouriteBillRequest).toHaveBeenCalledWith("bill-a");
      expect(mockFavouriteBillRequest).toHaveBeenCalledWith("bill-b");
      expect(mockUnfavouriteBillRequest).not.toHaveBeenCalled();
    });
  });

  describe("favouriting a bill", () => {
    it("updates the UI optimistically — isFavourite becomes true before the mocked request resolves", async () => {
      // delay resolution so we can observe the optimistic state mid-flight
      // without racing against an immediate resolve/reject
      let resolveRequest: () => void = () => {};
      mockFavouriteBillRequest.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRequest = () => resolve(undefined);
          }),
      );

      const bill = makeBill();
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      act(() => {
        result.current.toggle(bill);
      });

      await waitFor(() => expect(result.current.isFavourite(bill.id)).toBe(true));

      resolveRequest();

      await waitFor(() => expect(mockFavouriteBillRequest).toHaveBeenCalled());
    });

    it("includes the bill in favourites and favouriteIds after toggling", async () => {
      const bill = makeBill({ id: "bill-1" });
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      act(() => {
        result.current.toggle(bill);
      });

      await waitFor(() => expect(result.current.favouriteIds).toContain("bill-1"));
      expect(result.current.favourites).toContainEqual(bill);
    });

    it("rolls back the optimistic update if favouriteBillRequest rejects", async () => {
      mockFavouriteBillRequest.mockRejectedValue(new Error("network error"));

      const bill = makeBill();
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      act(() => {
        result.current.toggle(bill);
      });

      // Note: we don't assert the transient `true` state here. The
      // optimistic-then-rejected-then-rolled-back sequence can complete
      // within a single microtask tick when the rejection is immediate,
      // so trying to catch isFavourite === true in between is racy and
      // not actually what matters for correctness. What matters: the
      // request was attempted, and the final, settled state is rolled
      // back to not-favourited. The separate "updates the UI
      // optimistically" test above already proves the optimistic update
      // itself works, using a controlled, non-immediately-resolving
      // promise specifically so that moment is observable.
      await waitFor(() => expect(mockFavouriteBillRequest).toHaveBeenCalledWith(bill.id));
      await waitFor(() => expect(result.current.isFavourite(bill.id)).toBe(false));
    });
  });

  describe("un-favouriting a bill", () => {
    it("removes the bill from favourites when toggled a second time", async () => {
      const bill = makeBill({ id: "bill-1" });
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      act(() => {
        result.current.toggle(bill);
      });
      await waitFor(() => expect(result.current.isFavourite(bill.id)).toBe(true));

      act(() => {
        result.current.toggle(bill);
      });
      await waitFor(() => expect(result.current.isFavourite(bill.id)).toBe(false));

      expect(result.current.favouriteIds).not.toContain("bill-1");
    });

    it("rolls back to favourited if unfavouriteBillRequest rejects", async () => {
      const bill = makeBill({ id: "bill-1" });
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      // first toggle succeeds normally
      act(() => {
        result.current.toggle(bill);
      });
      await waitFor(() => expect(result.current.isFavourite(bill.id)).toBe(true));

      // second toggle (un-favourite) fails
      mockUnfavouriteBillRequest.mockRejectedValue(new Error("network error"));
      act(() => {
        result.current.toggle(bill);
      });

      await waitFor(() => expect(mockUnfavouriteBillRequest).toHaveBeenCalledWith("bill-1"));
      await waitFor(() => expect(result.current.isFavourite(bill.id)).toBe(true));
    });
  });

  describe("multiple bills", () => {
    it("tracks favourites independently per bill id", async () => {
      const billA = makeBill({ id: "a" });
      const billB = makeBill({ id: "b" });
      const { result } = renderHook(() => useFavourites(), { wrapper: createWrapper() });

      act(() => {
        result.current.toggle(billA);
      });
      await waitFor(() => expect(result.current.isFavourite("a")).toBe(true));

      act(() => {
        result.current.toggle(billB);
      });
      await waitFor(() => expect(result.current.isFavourite("b")).toBe(true));

      expect(result.current.favouriteIds.sort()).toEqual(["a", "b"]);

      act(() => {
        result.current.toggle(billA);
      });
      await waitFor(() => expect(result.current.isFavourite("a")).toBe(false));

      // billB should be unaffected by toggling billA
      expect(result.current.isFavourite("b")).toBe(true);
      expect(result.current.favouriteIds).toEqual(["b"]);
    });
  });
});
