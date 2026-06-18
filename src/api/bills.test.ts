import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBills, mapBillRecord } from "./bills";
import type { BillRecord, BillsApiResponse } from "@/types";

describe("fetchBills", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockResponse(body: BillsApiResponse) {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
    });
  }

  const emptyResponse: BillsApiResponse = {
    head: { counts: { billCount: 0 } },
    results: [],
  };

  it("calls the legislation endpoint with default limit and skip", async () => {
    mockResponse(emptyResponse);

    await fetchBills();

    const calledUrl = new URL((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/api/v1/legislation");
    expect(calledUrl.searchParams.get("limit")).toBe("20");
    expect(calledUrl.searchParams.get("skip")).toBe("0");
  });

  it("forwards custom limit and skip as query params", async () => {
    mockResponse(emptyResponse);

    await fetchBills({ limit: 50, skip: 100 });

    const calledUrl = new URL((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("limit")).toBe("50");
    expect(calledUrl.searchParams.get("skip")).toBe("100");
  });

  it("includes bill_type when provided", async () => {
    mockResponse(emptyResponse);

    await fetchBills({ bill_type: "pub" });

    const calledUrl = new URL((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("bill_type")).toBe("pub");
  });

  it("omits bill_type when not provided", async () => {
    mockResponse(emptyResponse);

    await fetchBills();

    const calledUrl = new URL((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(calledUrl.searchParams.has("bill_type")).toBe(false);
  });

  it("returns the parsed JSON body", async () => {
    const response: BillsApiResponse = {
      head: { counts: { billCount: 1 } },
      results: [],
    };
    mockResponse(response);

    const result = await fetchBills();

    expect(result).toEqual(response);
  });

  it("throws when the response is not ok", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    });

    await expect(fetchBills()).rejects.toThrow("API error: 500 Internal Server Error");
  });
});

describe("mapBillRecord", () => {
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

  it("maps basic fields straight across", () => {
    const result = mapBillRecord(buildRecord());

    expect(result.id).toBe("http://data.oireachtas.ie/ie/oireachtas/bill/2024/42");
    expect(result.billNo).toBe("42");
    expect(result.billYear).toBe("2024");
    expect(result.billType).toBe("Public");
    expect(result.status).toBe("First Stage");
  });

  it("builds billNoDisplay as billNo/billYear when year is present", () => {
    const result = mapBillRecord(buildRecord({ billNo: "42", billYear: "2024" }));
    expect(result.billNoDisplay).toBe("42/2024");
  });

  it("falls back to billNo alone when billYear is missing", () => {
    const result = mapBillRecord(buildRecord({ billYear: "" }));
    expect(result.billNoDisplay).toBe("42");
  });

  it("falls back to shortTitleEn/Ga when longTitle is missing", () => {
    const result = mapBillRecord(
      buildRecord({
        shortTitleEn: "Short EN",
        shortTitleGa: "Short GA",
        longTitleEn: undefined,
        longTitleGa: undefined,
      })
    );

    expect(result.longTitleEn).toBe("Short EN");
    expect(result.longTitleGa).toBe("Short GA");
  });

  it("prefers longTitle over shortTitle when both are present", () => {
    const result = mapBillRecord(
      buildRecord({
        shortTitleEn: "Short EN",
        longTitleEn: "Long EN",
      })
    );

    expect(result.longTitleEn).toBe("Long EN");
  });

  it("uses the named sponsor (by) when present", () => {
    const result = mapBillRecord(
      buildRecord({
        sponsors: [
          {
            sponsor: {
              as: { showAs: "Private Members'", uri: "uri-as" },
              by: { showAs: "Micheál Martin", uri: "uri-by" },
            },
          },
        ],
      })
    );

    expect(result.sponsor).toBe("Micheál Martin");
  });

  it("falls back to the sponsor role (as) when no named sponsor exists", () => {
    const result = mapBillRecord(
      buildRecord({
        sponsors: [
          {
            sponsor: {
              as: { showAs: "Government", uri: "uri-as" },
            },
          },
        ],
      })
    );

    expect(result.sponsor).toBe("Government");
  });

  it('defaults sponsor to "Unknown" when sponsors array is empty', () => {
    const result = mapBillRecord(buildRecord({ sponsors: [] }));
    expect(result.sponsor).toBe("Unknown");
  });

  it("reads originHouse.showAs when present, else empty string", () => {
    const withHouse = mapBillRecord(
      buildRecord({ originHouse: { showAs: "Dáil", uri: "uri-house" } })
    );
    expect(withHouse.originHouse).toBe("Dáil");

    const withoutHouse = mapBillRecord(buildRecord());
    expect(withoutHouse.originHouse).toBe("");
  });

  it("carries the bill uri through to both id and uri fields", () => {
    const result = mapBillRecord(
      buildRecord({ uri: "http://data.oireachtas.ie/ie/oireachtas/bill/2024/99" })
    );
    expect(result.id).toBe(result.uri);
    expect(result.uri).toBe("http://data.oireachtas.ie/ie/oireachtas/bill/2024/99");
  });
});
