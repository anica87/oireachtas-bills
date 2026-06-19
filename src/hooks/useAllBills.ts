import { useQuery } from "@tanstack/react-query";
import { fetchBills, mapBillRecord } from "@/api/bills";
import type { Bill } from "@/types";

const BATCH_SIZE = 1000; // backend's hard max per request

async function fetchAllBills(): Promise<Bill[]> {
  let skip = 0;
  let total = Infinity;
  const all: Bill[] = [];

  while (skip < total) {
    const response = await fetchBills({ limit: BATCH_SIZE, skip });
    total = response.head.counts.billCount;
    all.push(...response.results.map(mapBillRecord));
    skip += BATCH_SIZE;
  }

  return all;
}

export function useAllBills() {
  return useQuery<Bill[]>({
    queryKey: ["all-bills"],
    queryFn: fetchAllBills,
    staleTime: 1000 * 60 * 10,
  });
}