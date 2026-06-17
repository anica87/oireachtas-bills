/**
 * Data-fetching hooks built on TanStack Query.
 *
 * Generic hook pattern: useGenericFetch<T> wraps useQuery so callers
 * get fully-typed results without manual annotation.
 * InferFetchResult (using TypeScript's `infer`) keeps type derivations
 * in sync with the API functions automatically.
 */

import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";

import { type FetchBillsParams, fetchBills, mapBillRecord } from "@/api/bills";
import type {
  Bill,
  BillFilters,
  InferFetchResult,
  PaginatedResult,
  PaginationState,
} from "@/types";

// ─── Generic fetch hook ────────────────────────────────────────────────────

/**
 * Generic hook wrapping useQuery.
 * The type parameter T is inferred from the queryFn return type.
 */
export function useGenericFetch<T>(options: UseQueryOptions<T>): UseQueryResult<T> {
  return useQuery<T>(options);
}

// ─── Infer BillsApiResponse type from fetchBills ──────────────────────────

type BillsApiResponse = InferFetchResult<typeof fetchBills>;

// ─── useBills ─────────────────────────────────────────────────────────────

export interface UseBillsOptions {
  pagination: PaginationState;
  filters: BillFilters;
}

/**
 * Fetches a paginated + filtered list of bills.
 * Returns a PaginatedResult<Bill> — fully typed via generic.
 */
export function useBills({ pagination, filters }: UseBillsOptions) {
  const { pageIndex, pageSize } = pagination;
  const skip = pageIndex * pageSize;

  // Map UI filter values to API parameter names
  const apiParams: FetchBillsParams = {
    limit: pageSize,
    skip,
    bill_type: filters.billType || undefined,
    bill_status: filters.billStatus || undefined,
    chamber_id: filters.originHouse || undefined,
  };

  return useGenericFetch<PaginatedResult<Bill>>({
    queryKey: ["bills", apiParams],
    queryFn: async (): Promise<PaginatedResult<Bill>> => {
      const response: BillsApiResponse = await fetchBills(apiParams);

      const bills = response.results.map(mapBillRecord);

      // Client-side search filter (API doesn't support free-text search)
      const searchTerm = filters.search.trim().toLowerCase();
      const filtered = searchTerm
        ? bills.filter(
            (b) =>
              b.shortTitleEn.toLowerCase().includes(searchTerm) ||
              b.shortTitleGa.toLowerCase().includes(searchTerm) ||
              b.sponsor.toLowerCase().includes(searchTerm) ||
              b.billNoDisplay.toLowerCase().includes(searchTerm),
          )
        : bills;

      const total = response.head.counts.billCount;

      return {
        data: filtered,
        total,
        page: pageIndex,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  });
}
