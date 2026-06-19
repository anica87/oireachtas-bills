import { useQuery } from "@tanstack/react-query";
import { fetchBills, mapBillRecord } from "@/api/bills";
import { useAllBills } from "./useAllBills";
import type { Bill } from "@/types";

interface BillsResult {
  bills: Bill[];
  total: number;
}

// the actual contract BillsTable.tsx needs — nothing more
export interface UseBillsReturn {
  data: BillsResult | undefined;
  isLoading: boolean;
  error: Error | null;
}

interface UseBillsOptions {
  page: number;
  pageSize: number;
  typeFilter?: string;
}

export function useBills({ page, pageSize, typeFilter }: UseBillsOptions): UseBillsReturn {
  const allBillsQuery = useAllBills();

  const unfilteredQuery = useQuery<BillsResult>({
    queryKey: ["bills", page, pageSize],
    queryFn: async () => {
      const response = await fetchBills({ limit: pageSize, skip: page * pageSize });
      return {
        bills: response.results.map(mapBillRecord),
        total: response.head.counts.billCount,
      };
    },
    enabled: !typeFilter,
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  });

  if (typeFilter) {
    const allBills = allBillsQuery.data ?? [];
    const filtered = allBills.filter((b) => b.billType === typeFilter);
    const start = page * pageSize;

    return {
      data: { bills: filtered.slice(start, start + pageSize), total: filtered.length },
      isLoading: allBillsQuery.isLoading,
      error: allBillsQuery.error,
    };
  }

  return {
    data: unfilteredQuery.data,
    isLoading: unfilteredQuery.isLoading,
    error: unfilteredQuery.error,
  };
}