/**
 * API client for the Oireachtas REST API.
 *
 * Base URL: https://api.oireachtas.ie/v1
 * Proxied in dev via Vite to /api/v1 (see vite.config.ts)
 *
 * Key legislation endpoint parameters:
 *   limit       number of results (default 20)
 *   skip        offset for pagination
 *   bill_type   "pub" | "pri" | "pmb"  (public / private / private members')
 *   bill_status "Current" | "Enacted" | "Lapsed" | "Withdrawn" | "Defeated"
 *   chamber_id  "dail" | "seanad"
 */

import type {
  ApiSponsorEntry,
  Bill,
  BillRecord,
  BillsApiResponse,
  InferFetchResult,
} from "@/types";

const BASE_URL = "/api/v1";

// ─── Bill type param mapping ───────────────────────────────────────────────
// The API expects short codes, but we display the full names in the UI

export const BILL_TYPE_OPTIONS = [
  { label: "All types", value: "" },
  { label: "Public", value: "pub" },
  { label: "Private", value: "pri" },
  { label: "Private Members'", value: "pmb" },
] as const;

export const BILL_STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Current", value: "Current" },
  { label: "Enacted", value: "Enacted" },
  { label: "Lapsed", value: "Lapsed" },
  { label: "Withdrawn", value: "Withdrawn" },
  { label: "Defeated", value: "Defeated" },
] as const;

export const ORIGIN_HOUSE_OPTIONS = [
  { label: "All houses", value: "" },
  { label: "Dáil", value: "dail" },
  { label: "Seanad", value: "seanad" },
] as const;

// ─── Generic Fetch Utility ────────────────────────────────────────────────

/**
 * Type-safe fetch wrapper. Return type T is passed through to callers
 * without requiring manual annotation.
 */
async function apiFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${window.location.origin}${BASE_URL}${endpoint}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ─── Bills API ─────────────────────────────────────────────────────────────

export interface FetchBillsParams {
  limit?: number;
  skip?: number;
  /** API param — "pub" | "pri" | "pmb" */
  bill_type?: string;
  /** API param — "Current" | "Enacted" | "Lapsed" | "Withdrawn" | "Defeated" */
  bill_status?: string;
  /** API param — "dail" | "seanad" */
  chamber_id?: string;
}

export async function fetchBills(params: FetchBillsParams = {}): Promise<BillsApiResponse> {
  const queryParams: Record<string, string> = {
    limit: String(params.limit ?? 20),
    skip: String(params.skip ?? 0),
  };

  if (params.bill_type) queryParams.bill_type = params.bill_type;
  if (params.bill_status) queryParams.bill_status = params.bill_status;
  if (params.chamber_id) queryParams.chamber_id = params.chamber_id;

  return apiFetch<BillsApiResponse>("/legislation", queryParams);
}

// ─── Data Mapper ───────────────────────────────────────────────────────────

/**
 * Maps the raw API BillRecord → application Bill model.
 *
 * Sponsor extraction logic (from real API structure):
 *   - Each entry in sponsors is: { sponsor: { as: {...}, by?: {...} } }
 *   - "as" is the role/capacity e.g. "Government"
 *   - "by" is the individual person e.g. "Micheál Martin" (absent for Govt bills)
 *   - We prefer by.showAs (the person's name), falling back to as.showAs (the role)
 */
export function mapBillRecord(record: BillRecord): Bill {
  const { bill } = record;

  const sponsor = extractSponsorName(bill.sponsors);

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

/**
 * Extracts a human-readable sponsor name from the sponsors array.
 *
 * The API wraps each sponsor in a { sponsor: { as, by? } } object.
 * Priority: by.showAs (person name) > as.showAs (role) > "Unknown"
 */
function extractSponsorName(sponsors: ApiSponsorEntry[]): string {
  if (!sponsors || sponsors.length === 0) return "Unknown";

  const first = sponsors[0].sponsor;
  if (!first) return "Unknown";

  // Prefer the person's name over the role description
  return first.by?.showAs ?? first.as?.showAs ?? "Unknown";
}

// ─── Favourite Mock API ────────────────────────────────────────────────────

/**
 * Mock server call for toggling a bill favourite.
 * In production this would be a real API endpoint.
 * Console logs confirm the request was dispatched.
 */
export async function toggleFavouriteBillApi(
  billId: string,
  isFavourite: boolean,
): Promise<{ success: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(
    `[API] Favourite ${isFavourite ? "added" : "removed"} — request dispatched to server`,
    { billId, isFavourite, timestamp: new Date().toISOString() },
  );

  // Simulate ~5% failure rate for realistic error handling
  if (Math.random() < 0.05) {
    throw new Error("Server error: failed to update favourite status");
  }

  return { success: true };
}

// ─── Type inference demo ───────────────────────────────────────────────────

/**
 * BillsData is inferred from fetchBills using InferFetchResult.
 * If fetchBills changes its return type, BillsData updates automatically.
 */
export type BillsData = InferFetchResult<typeof fetchBills>;
