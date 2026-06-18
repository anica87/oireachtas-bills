import { useQuery } from "@tanstack/react-query";
import { fetchBills, mapBillRecord } from "@/api/bills";
import type { Bill } from "@/types";

interface UseBillsOptions {
  page: number;
  pageSize: number;
  typeFilter?: string;
}

interface BillsResult {
  bills: Bill[];
  total: number;
}

export function useBills({ page, pageSize, typeFilter }: UseBillsOptions) {
  return useQuery<BillsResult>({
    queryKey: ["bills", page, pageSize, typeFilter],
    queryFn: async () => {
      const response = await fetchBills({
        limit: pageSize,
        skip: page * pageSize,
        bill_type: typeFilter || undefined,
      });
      return {
        bills: response.results.map(mapBillRecord),
        total: response.head.counts.billCount,
      };
    },
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  });
}
