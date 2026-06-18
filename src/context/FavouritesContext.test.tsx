import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FavouritesProvider, useFavourites } from "./FavouritesContext";
import type { Bill } from "@/types";

function buildBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    billNo: "1",
    billYear: "2024",
    billNoDisplay: "1/2024",
    billType: "Public",
    status: "First Stage",
    shortTitleEn: "Short EN",
    shortTitleGa: "Short GA",
    longTitleEn: "Long EN",
    longTitleGa: "Long GA",
    sponsor: "Unknown",
    originHouse: "Dáil",
    uri: "http://data.oireachtas.ie/ie/oireachtas/bill/2024/1",
    ...overrides,
  };
}

function renderUseFavourites() {
  return renderHook(() => useFavourites(), {
    wrapper: ({ children }) => <FavouritesProvider>{children}</FavouritesProvider>,
  });
}

describe("useFavourites", () => {
  it("throws when used outside a FavouritesProvider", () => {
    expect(() => renderHook(() => useFavourites())).toThrow(
      "useFavourites must be used within FavouritesProvider"
    );
  });

  it("starts with no favourites", () => {
    const { result } = renderUseFavourites();

    expect(result.current.favourites).toEqual([]);
    expect(result.current.favouriteIds).toEqual([]);
  });

  it("reports a bill as not favourited initially", () => {
    const { result } = renderUseFavourites();
    expect(result.current.isFavourite("bill-1")).toBe(false);
  });

  it("adds a bill to favourites on toggle", () => {
    const { result } = renderUseFavourites();
    const bill = buildBill();

    act(() => result.current.toggle(bill));

    expect(result.current.isFavourite(bill.id)).toBe(true);
    expect(result.current.favourites).toEqual([bill]);
    expect(result.current.favouriteIds).toEqual([bill.id]);
  });

  it("removes a bill from favourites when toggled again", () => {
    const { result } = renderUseFavourites();
    const bill = buildBill();

    act(() => result.current.toggle(bill));
    act(() => result.current.toggle(bill));

    expect(result.current.isFavourite(bill.id)).toBe(false);
    expect(result.current.favourites).toEqual([]);
    expect(result.current.favouriteIds).toEqual([]);
  });

  it("tracks multiple favourites independently", () => {
    const { result } = renderUseFavourites();
    const billA = buildBill({ id: "bill-a" });
    const billB = buildBill({ id: "bill-b" });

    act(() => result.current.toggle(billA));
    act(() => result.current.toggle(billB));

    expect(result.current.isFavourite("bill-a")).toBe(true);
    expect(result.current.isFavourite("bill-b")).toBe(true);
    expect(result.current.favourites).toHaveLength(2);

    act(() => result.current.toggle(billA));

    expect(result.current.isFavourite("bill-a")).toBe(false);
    expect(result.current.isFavourite("bill-b")).toBe(true);
    expect(result.current.favourites).toEqual([billB]);
  });

  it("isFavourite returns false for ids that were never added", () => {
    const { result } = renderUseFavourites();
    act(() => result.current.toggle(buildBill({ id: "bill-a" })));

    expect(result.current.isFavourite("some-other-id")).toBe(false);
  });
});
