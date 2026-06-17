/**
 * Unit tests for API utilities.
 *
 * Tests:
 *  - mapBillRecord: all fields mapped correctly
 *  - Sponsor extraction: by.showAs > as.showAs > "Unknown"
 *  - billNoDisplay format: "42/2024"
 *  - Missing optional fields handled gracefully
 */

import { describe, expect, it } from "vitest";
import { mapBillRecord } from "@/api/bills";
import type { BillRecord } from "@/types";

// ─── Fixture ───────────────────────────────────────────────────────────────

const baseRecord: BillRecord = {
  bill: {
    billNo: "42",
    billYear: "2024",
    billType: "Public",
    status: "First Stage",
    shortTitleEn: "Finance Act 2024",
    shortTitleGa: "Acht Airgeadais 2024",
    longTitleEn: "An act to provide for finance",
    longTitleGa: "Acht chun airgeadas a sholáthar",
    sponsors: [
      {
        sponsor: {
          as: { showAs: "Government", uri: "http://example.com/gov" },
          by: { showAs: "Micheál Martin", uri: "http://example.com/taoiseach" },
        },
      },
    ],
    uri: "http://data.oireachtas.ie/ie/oireachtas/bill/2024/42",
    originHouse: { showAs: "Dáil", uri: "http://example.com/dail" },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────

describe("mapBillRecord", () => {
  it("maps billNo correctly", () => {
    expect(mapBillRecord(baseRecord).billNo).toBe("42");
  });

  it("maps billYear correctly", () => {
    expect(mapBillRecord(baseRecord).billYear).toBe("2024");
  });

  it("formats billNoDisplay as 'billNo/billYear'", () => {
    expect(mapBillRecord(baseRecord).billNoDisplay).toBe("42/2024");
  });

  it("maps billType correctly", () => {
    expect(mapBillRecord(baseRecord).billType).toBe("Public");
  });

  it("maps status correctly", () => {
    expect(mapBillRecord(baseRecord).status).toBe("First Stage");
  });

  it("prefers sponsor.by.showAs over sponsor.as.showAs", () => {
    // Real API: by = the person, as = the role
    expect(mapBillRecord(baseRecord).sponsor).toBe("Micheál Martin");
  });

  it("falls back to sponsor.as.showAs when by is absent (government bill)", () => {
    const record: BillRecord = {
      ...baseRecord,
      bill: {
        ...baseRecord.bill,
        sponsors: [
          {
            sponsor: {
              as: { showAs: "Government", uri: "http://example.com/gov" },
              // no 'by' — government bill
            },
          },
        ],
      },
    };
    expect(mapBillRecord(record).sponsor).toBe("Government");
  });

  it("returns 'Unknown' when sponsors array is empty", () => {
    const record: BillRecord = {
      ...baseRecord,
      bill: { ...baseRecord.bill, sponsors: [] },
    };
    expect(mapBillRecord(record).sponsor).toBe("Unknown");
  });

  it("maps originHouse from bill.originHouse.showAs", () => {
    expect(mapBillRecord(baseRecord).originHouse).toBe("Dáil");
  });

  it("defaults originHouse to empty string when absent", () => {
    const record: BillRecord = {
      ...baseRecord,
      bill: { ...baseRecord.bill, originHouse: undefined },
    };
    expect(mapBillRecord(record).originHouse).toBe("");
  });

  it("uses uri as id", () => {
    expect(mapBillRecord(baseRecord).id).toBe(
      "http://data.oireachtas.ie/ie/oireachtas/bill/2024/42",
    );
  });

  it("maps English and Irish short titles", () => {
    const bill = mapBillRecord(baseRecord);
    expect(bill.shortTitleEn).toBe("Finance Act 2024");
    expect(bill.shortTitleGa).toBe("Acht Airgeadais 2024");
  });

  it("falls back longTitleEn to shortTitleEn when absent", () => {
    const record: BillRecord = {
      ...baseRecord,
      bill: {
        ...baseRecord.bill,
        longTitleEn: undefined,
        shortTitleEn: "Short title only",
      },
    };
    expect(mapBillRecord(record).longTitleEn).toBe("Short title only");
  });

  it("handles billYear being absent — billNoDisplay uses billNo only", () => {
    const record: BillRecord = {
      ...baseRecord,
      bill: { ...baseRecord.bill, billYear: undefined as unknown as string },
    };
    const bill = mapBillRecord(record);
    expect(bill.billNoDisplay).toBe("42");
  });
});
