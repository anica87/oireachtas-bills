import { useQuery } from "@tanstack/react-query";
import { fetchBills, mapBillRecord } from "@/api/bills";
import type { Bill } from "@/types";

const BATCH_SIZE = 1000; // backend's hard max per request

/**
 * Fetches every bill from the backend, batched at BATCH_SIZE per request
 * (the backend's hard limit). Strategy:
 *
 *   1. Fetch the first batch (skip=0) on its own — this is the only request
 *      whose existence we know about upfront, and its response tells us the
 *      true total count.
 *   2. Once total is known, compute how many additional batches are needed
 *      and fire them all CONCURRENTLY with Promise.all, rather than awaiting
 *      one at a time in a sequential loop.
 *
 * For ~6000 bills (6 batches), this turns "6 round trips in sequence" into
 * "1 round trip, then 5 in parallel" — wall-clock time approaches the
 * latency of a single request plus one round trip, rather than 6x that.
 *
 * Trade-off: this fires multiple concurrent requests against the backend.
 * If the backend has aggressive per-client rate limiting, sequential may be
 * safer — worth confirming there's no rate limit before relying on this in
 * production. For a read-only, low-churn dataset like legislation records,
 * concurrent batches are a reasonable bet.
 */
async function fetchAllBills(): Promise<Bill[]> {
  const first = await fetchBills({ limit: BATCH_SIZE, skip: 0 });
  const total = first.head.counts.billCount;
  const firstBatchBills = first.results.map(mapBillRecord);

  const remainingBatchCount = Math.max(0, Math.ceil((total - BATCH_SIZE) / BATCH_SIZE));

  if (remainingBatchCount === 0) {
    return firstBatchBills;
  }

  const remainingSkips = Array.from(
    { length: remainingBatchCount },
    (_, i) => (i + 1) * BATCH_SIZE,
  );

  //If any single batch request fails, fetchAllBills rejects entirely rather than returning partial data.
  //  This matches the original sequential implementation's behavior.
  //  A more resilient version could use Promise.allSettled to
  //  return whatever batches succeeded, surfacing a "partial data" warning rather than failing outright — not implemented here, since partial bill data could itself be confusing/misleading in a legislation-tracking context (better to show "couldn't load" than incomplete results without indication).
  const remainingResponses = await Promise.all(
    remainingSkips.map((skip) => fetchBills({ limit: BATCH_SIZE, skip })),
  );

  const remainingBills = remainingResponses.flatMap((response) =>
    response.results.map(mapBillRecord),
  );

  return [...firstBatchBills, ...remainingBills];
}

export function useAllBills(enabled: boolean = true) {
  return useQuery<Bill[]>({
    queryKey: ["all-bills"],
    queryFn: fetchAllBills,
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}
