/**
 * Core domain types for the Oireachtas Bills application.
 *
 * The real API response from https://api.oireachtas.ie/v1/legislation has this shape:
 *
 * {
 *   head: { counts: { billCount: number } },
 *   results: [
 *     {
 *       bill: {
 *         billNo: "42",
 *         billYear: "2024",
 *         billType: "Public",            // "Public" | "Private" | "Private Members'"
 *         status: "First Stage",         // current stage of the bill
 *         shortTitleEn: "...",
 *         shortTitleGa: "...",
 *         longTitleEn: "...",
 *         longTitleGa: "...",
 *         originHouse: { showAs: "Dáil", uri: "..." },
 *         sponsors: [
 *           {
 *             sponsor: {
 *               as: { showAs: "Government", uri: "..." },  // the role/capacity
 *               by: { showAs: "Micheál Martin", uri: "..." }  // the person (optional)
 *             }
 *           }
 *         ],
 *         uri: "http://data.oireachtas.ie/ie/oireachtas/bill/2024/42",
 *         method: "Initiated",
 *         mostRecentStage: { event: { dates: [...], house: {...} } }
 *       }
 *     }
 *   ]
 * }
 *
 * Key points discovered from real API:
 * - sponsors is array of { sponsor: { as: {...}, by?: {...} } }  (note the nested "sponsor" key)
 * - bill_type filter param uses values like "pub" not "Public"
 * - status filter param: "Current", "Enacted", "Lapsed", "Withdrawn", "Defeated"
 * - The API supports: bill_type, bill_status, date_start, date_end, chamber_id, member_id
 */

// ─── Raw API Response Shape ────────────────────────────────────────────────

export interface ApiSponsorEntry {
  sponsor: {
    /** The role/capacity (e.g. "Government", "Private Members'") */
    as: {
      showAs: string;
      uri: string;
    };
    /** The individual person sponsor (optional – absent for Government bills) */
    by?: {
      showAs: string;
      uri: string;
      memberCode?: string;
    };
  };
}

export interface BillRecord {
  bill: {
    billNo: string;
    billYear: string;
    billType: string;
    status: string;
    shortTitleEn: string;
    shortTitleGa: string;
    longTitleEn?: string;
    longTitleGa?: string;
    sponsors: ApiSponsorEntry[];
    uri: string;
    originHouse?: {
      showAs: string;
      uri: string;
    };
    method?: string;
  };
}

export interface BillsApiResponse {
  head: {
    counts: {
      billCount: number;
    };
    dateRange?: {
      start: string;
      end: string;
    };
  };
  results: BillRecord[];
}

// ─── Domain Models ─────────────────────────────────────────────────────────

/**
 * Flattened, application-level Bill model.
 * Derived from the raw API shape by mapBillRecord().
 */
export interface Bill {
  /** Unique identifier — the full bill URI */
  id: string;
  /** Bill number e.g. "42" */
  billNo: string;
  /** Year e.g. "2024" */
  billYear: string;
  /** Display number e.g. "42/2024" */
  billNoDisplay: string;
  /** "Public" | "Private" | "Private Members'" */
  billType: string;
  /** Current stage e.g. "First Stage", "Enacted" */
  status: string;
  shortTitleEn: string;
  shortTitleGa: string;
  longTitleEn: string;
  longTitleGa: string;
  /**
   * Human-readable sponsor name.
   * For government bills: "Government"
   * For private members' bills: the TD's name
   */
  sponsor: string;
  /** House where bill originated: "Dáil" | "Seanad" */
  originHouse: string;
  uri: string;
}

// ─── Filter State ──────────────────────────────────────────────────────────

export interface BillFilters {
  /** e.g. "Public", "Private", "" for all */
  billType: string;
  /** e.g. "Current", "Enacted", "Lapsed", "" for all */
  billStatus: string;
  /** e.g. "Dáil", "Seanad", "" for all */
  originHouse: string;
  /** Free text search on title */
  search: string;
}

// ─── Pagination ────────────────────────────────────────────────────────────

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Favourites ────────────────────────────────────────────────────────────

export type FavouriteStatus = "idle" | "loading" | "success" | "error";

export interface FavouriteEntry {
  billId: string;
  isFavourite: boolean;
  status: FavouriteStatus;
}

// ─── Table ─────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc" | false;

export interface ColumnDef<TData> {
  /** Unique key matching a property of TData, or a custom id */
  key: string;
  /** Column header label */
  header: string;
  /** Optional: key in TData to sort by (if different from key, or false to disable) */
  sortKey?: string | false;
  /** Cell render function — receives the row data */
  cell: (row: TData) => React.ReactNode;
  /** Optional min-width CSS value */
  minWidth?: string;
  /** Optional width CSS value */
  width?: string;
}

export interface SortState {
  key: string;
  direction: SortDirection;
}

// ─── Utility Types ─────────────────────────────────────────────────────────

/**
 * Infers the resolved return type of an async function.
 * Uses TypeScript's `infer` keyword — keeps derived types in sync automatically.
 *
 * @example
 * async function fetchBills(): Promise<BillsApiResponse> { ... }
 * type BillsData = InferFetchResult<typeof fetchBills>; // → BillsApiResponse
 */
export type InferFetchResult<T extends (...args: never[]) => Promise<unknown>> = T extends (
  ...args: never[]
) => Promise<infer R>
  ? R
  : never;

/**
 * Makes all properties required and non-nullable.
 */
export type RequiredNonNullable<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};

/**
 * Extract element type from an array type.
 */
export type ArrayElement<T extends readonly unknown[]> =
  T extends ReadonlyArray<infer E> ? E : never;
