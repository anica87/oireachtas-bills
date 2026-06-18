import type { Bill, BillRecord, BillsApiResponse } from "@/types";

const BASE_URL = "/api/v1";

async function apiFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${window.location.origin}${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Bills ─────────────────────────────────────────────────────────────────

export interface FetchBillsParams {
  limit?: number;
  skip?: number;
  bill_type?: string;
}

export async function fetchBills(params: FetchBillsParams = {}): Promise<BillsApiResponse> {
  return apiFetch<BillsApiResponse>("/legislation", {
    limit: String(params.limit ?? 20),
    skip: String(params.skip ?? 0),
    ...(params.bill_type && { bill_type: params.bill_type }),
  });
}

export function mapBillRecord(record: BillRecord): Bill {
  const { bill } = record;
  const firstSponsor = bill.sponsors?.[0]?.sponsor;
  const sponsor = firstSponsor?.by?.showAs ?? firstSponsor?.as?.showAs ?? "Unknown";

  return {
    id: bill.uri,
    billNo: bill.billNo,
    billYear: bill.billYear ?? "",
    billNoDisplay: bill.billYear ? `${bill.billNo}/${bill.billYear}` : bill.billNo,
    billType: bill.billType ?? "",
    status: bill.status ?? "",
    shortTitleEn: bill.shortTitleEn ?? "",
    shortTitleGa: bill.shortTitleGa ?? "",
    longTitleEn: bill.longTitleEn ?? bill.shortTitleEn ?? "",
    longTitleGa: bill.longTitleGa ?? bill.shortTitleGa ?? "",
    sponsor,
    originHouse: bill.originHouse?.showAs ?? "",
    uri: bill.uri,
  };
}

// ─── Filter options ────────────────────────────────────────────────────────

export const BILL_TYPE_OPTIONS = [
  { label: "All types", value: "" },
  { label: "Public", value: "pub" },
  { label: "Private", value: "pri" },
  { label: "Private Members'", value: "pmb" },
] as const;
