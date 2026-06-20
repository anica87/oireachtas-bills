import { useMemo } from "react";
import { useAllBills } from "./useAllBills";

export function useBillTypes(enabled: boolean = true): { types: string[]; isLoading: boolean } {
  const { data: bills, isLoading } = useAllBills(enabled);

  const types = useMemo(() => {
    if (!bills) return [];
    return Array.from(new Set(bills.map((b) => b.billType).filter(Boolean)));
  }, [bills]);

  return { types, isLoading };
}
